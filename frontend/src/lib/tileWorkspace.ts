export type SecondaryTile = { path: string; key: string };
export type TileWorkspaceState = { secondary: SecondaryTile[] };

export const initialTileWorkspaceState: TileWorkspaceState = {
  secondary: [],
};

export function openTileLink(
  state: TileWorkspaceState,
  path: string,
  key: string
): TileWorkspaceState {
  const newTile: SecondaryTile = { path, key };
  const newSecondary = [newTile, ...state.secondary].slice(0, 2);
  return { secondary: newSecondary };
}

export function closeTile(
  state: TileWorkspaceState,
  key: string
): TileWorkspaceState {
  const newSecondary = state.secondary.filter((tile) => tile.key !== key);
  if (newSecondary.length === state.secondary.length) {
    return state;
  }
  return { secondary: newSecondary };
}

export function promoteTile(
  state: TileWorkspaceState,
  key: string,
  replacementPath: string,
  replacementKey: string
): TileWorkspaceState {
  const foundIndex = state.secondary.findIndex((tile) => tile.key === key);
  if (foundIndex === -1) {
    return state;
  }
  const newSecondary = state.secondary.map((tile) =>
    tile.key === key ? { path: replacementPath, key: replacementKey } : tile
  );
  return { secondary: newSecondary };
}

export function resetTiles(): TileWorkspaceState {
  return { secondary: [] };
}
