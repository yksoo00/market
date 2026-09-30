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

export function updateTilePath(
  state: TileWorkspaceState,
  key: string,
  path: string
): TileWorkspaceState {
  const found = state.secondary.find((tile) => tile.key === key);
  // iframe이 같은 경로를 다시 보고하는 경우가 잦아서, 변화가 없으면 같은 참조를 돌려 리렌더를 막는다.
  if (!found || found.path === path) {
    return state;
  }
  const newSecondary = state.secondary.map((tile) =>
    tile.key === key ? { ...tile, path } : tile
  );
  return { secondary: newSecondary };
}

export function resetTiles(): TileWorkspaceState {
  return { secondary: [] };
}
