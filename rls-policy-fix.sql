-- ============================================================================
-- COMPREHENSIVE RLS POLICY FIX
-- Fixes infinite recursion in squads and squad_members policies
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL PROBLEMATIC POLICIES
-- ============================================================================

-- Drop squads policies
DROP POLICY IF EXISTS "Users can view accessible squads" ON squads;
DROP POLICY IF EXISTS "Users can create squads" ON squads;
DROP POLICY IF EXISTS "Owners and admins can update squads" ON squads;
DROP POLICY IF EXISTS "Owners can delete squads" ON squads;

-- Drop squad_members policies
DROP POLICY IF EXISTS "Users can view squad members" ON squad_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON squad_members;
DROP POLICY IF EXISTS "Users can join or be added to squads" ON squad_members;
DROP POLICY IF EXISTS "Users can update squad membership" ON squad_members;
DROP POLICY IF EXISTS "Users can leave or be removed from squads" ON squad_members;

-- ============================================================================
-- STEP 2: CREATE SECURITY DEFINER FUNCTION
-- This function can check membership without triggering RLS recursion
-- ============================================================================

-- Drop existing functions first (they may have different parameter names)
DROP FUNCTION IF EXISTS public.is_squad_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_squad_admin(UUID, UUID);
DROP FUNCTION IF EXISTS is_squad_member(UUID, UUID);
DROP FUNCTION IF EXISTS is_squad_admin(UUID, UUID);

CREATE OR REPLACE FUNCTION public.is_squad_member(p_squad_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM squad_members 
    WHERE squad_id = p_squad_id 
    AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_squad_admin(p_squad_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM squad_members 
    WHERE squad_id = p_squad_id 
    AND user_id = p_user_id
    AND role IN ('owner', 'admin')
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_squad_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_squad_admin(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 3: CREATE NEW SQUADS POLICIES (using owner_id, no member check)
-- ============================================================================

-- SELECT: Anyone can view public squads, owners can view their private squads
-- We use the security definer function to check membership
CREATE POLICY "Users can view accessible squads" ON squads FOR SELECT USING (
  NOT is_private 
  OR owner_id = auth.uid()
  OR public.is_squad_member(id, auth.uid())
);

-- INSERT: Any authenticated user can create a squad (they become owner)
CREATE POLICY "Users can create squads" ON squads FOR INSERT WITH CHECK (
  auth.uid() = owner_id
);

-- UPDATE: Only the owner can update squad details
CREATE POLICY "Owners can update squads" ON squads FOR UPDATE USING (
  owner_id = auth.uid()
);

-- DELETE: Only the owner can delete squads
CREATE POLICY "Owners can delete squads" ON squads FOR DELETE USING (
  owner_id = auth.uid()
);

-- ============================================================================
-- STEP 4: CREATE NEW SQUAD_MEMBERS POLICIES (using squads.owner_id)
-- ============================================================================

-- SELECT: Users can view their own membership, or members of squads they own
CREATE POLICY "Users can view squad members" ON squad_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND squads.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND NOT squads.is_private
  )
);

-- INSERT: Users can add themselves, or owners can add others
CREATE POLICY "Users can join squads" ON squad_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND squads.owner_id = auth.uid()
  )
);

-- UPDATE: Users can update their own membership, owners can update any
CREATE POLICY "Users can update membership" ON squad_members FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND squads.owner_id = auth.uid()
  )
);

-- DELETE: Users can leave, owners can remove anyone
CREATE POLICY "Users can leave squads" ON squad_members FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND squads.owner_id = auth.uid()
  )
);

-- ============================================================================
-- DONE! The policies now avoid circular references by:
-- 1. Squads policies use owner_id directly OR security definer function
-- 2. Squad_members policies only reference squads.owner_id (not squad_members)
-- ============================================================================
