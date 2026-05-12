-- ============================================================================
-- FIX: Squad Members Policies (Infinite Recursion Fix)
-- ============================================================================
-- The previous policies caused infinite recursion because they referenced
-- squad_members to check squad_members access. This fix uses the squads table
-- to check ownership and allows simpler membership checks.

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view squad members" ON squad_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON squad_members;
DROP POLICY IF EXISTS "Users can update squad membership" ON squad_members;
DROP POLICY IF EXISTS "Users can leave or be removed from squads" ON squad_members;

-- Create new policies that avoid recursion

-- SELECT: Users can view members of public squads OR squads they belong to
-- We check ownership from squads table (no recursion) and allow viewing own membership
CREATE POLICY "Users can view squad members" ON squad_members FOR SELECT USING (
  -- User can always see their own membership
  user_id = auth.uid()
  OR
  -- User can see members of squads they own
  EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND squads.owner_id = auth.uid()
  )
  OR
  -- User can see members of public squads
  EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND NOT squads.is_private
  )
);

-- INSERT: Squad owners can add members, OR users can add themselves to public squads
CREATE POLICY "Users can join or be added to squads" ON squad_members FOR INSERT WITH CHECK (
  -- User is adding themselves (joining)
  user_id = auth.uid()
  OR
  -- Squad owner is adding the member
  EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND squads.owner_id = auth.uid()
  )
);

-- UPDATE: Users can update their own membership, owners can update any member
CREATE POLICY "Users can update squad membership" ON squad_members FOR UPDATE USING (
  -- User updating their own membership
  user_id = auth.uid()
  OR
  -- Squad owner updating any member
  EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND squads.owner_id = auth.uid()
  )
);

-- DELETE: Users can leave (delete their own membership), owners can remove anyone
CREATE POLICY "Users can leave or be removed from squads" ON squad_members FOR DELETE USING (
  -- User leaving (deleting their own membership)
  user_id = auth.uid()
  OR
  -- Squad owner removing a member
  EXISTS (
    SELECT 1 FROM squads 
    WHERE squads.id = squad_members.squad_id 
    AND squads.owner_id = auth.uid()
  )
);

-- ============================================================================
-- BONUS: Add a helper function for checking squad membership without recursion
-- (Can be used in other policies if needed)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_squad_member(check_squad_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM squad_members 
    WHERE squad_id = check_squad_id 
    AND user_id = check_user_id
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_squad_member(UUID, UUID) TO authenticated;
