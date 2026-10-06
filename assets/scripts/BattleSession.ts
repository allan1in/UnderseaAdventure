import { Node } from 'cc';

// 以本局英雄为键，重新加载场景时自动恢复等待状态。
const startedHeroes = new WeakSet<Node>();

export function startBattle(hero: Node): void { startedHeroes.add(hero); }

export function hasBattleStarted(hero: Node | null): boolean {
    return !!hero && startedHeroes.has(hero);
}
