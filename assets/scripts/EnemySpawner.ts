import { _decorator, Canvas, Component, director, instantiate, Node, Prefab, screen, UITransform, Vec2, Vec3 } from 'cc';
import { CircleBody2D } from './CircleBody2D';
import { EnemyController } from './EnemyController';
import { HeroHealth } from './HeroHealth';
import { hasBattleStarted } from './BattleSession';

const { ccclass, executionOrder, property } = _decorator;
type Bounds = { left: number; right: number; bottom: number; top: number };

@ccclass('EnemySpawner')
@executionOrder(50)
export class EnemySpawner extends Component {
    @property({ type: Prefab, tooltip: '拖入 Assets/prefabs 中的 Enemy.prefab 文件' })
    enemyPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: '拖入 Hierarchy 中的 Hero 节点' })
    hero: Node | null = null;

    @property({ type: Node, tooltip: '新敌人会直接放到这个 World 节点下' })
    world: Node | null = null;

    @property({ type: Node, tooltip: '拖入 World 下的 Ground，用它的尺寸检查出生点是否在地图内' })
    ground: Node | null = null;

    @property({ tooltip: '尝试生成一只敌人的间隔，单位秒' })
    spawnInterval = 0.3;

    @property({ tooltip: '同时存活的敌人数量上限；场景中手动放置的 Enemy 也计入' })
    maxAlive = 200;

    @property({ tooltip: '出生时，敌人图片与当前可见画面边缘之间预留的距离' })
    spawnMargin = 80;

    @property({ tooltip: '出生点与 Hero 中心的最小距离，避免贴着主角突然出现' })
    minHeroDistance = 220;

    private timer = 0;

    lateUpdate(deltaTime: number): void {
        if (director.isPaused() || !hasBattleStarted(this.hero)) return;
        // Hero 先更新滚屏，再按本帧真实视口生成；随后 WorldDepthSort 排列新敌人。
        if (!this.world?.isValid || !this.hero?.isValid || !this.ground?.isValid || !this.enemyPrefab) return;
        if (!this.hero.activeInHierarchy || this.hero.parent !== this.world || this.ground.parent !== this.world) return;
        const heroHealth = this.hero.getComponent(HeroHealth);
        if (heroHealth && !heroHealth.isAlive) return;

        let alive = 0;
        for (const node of this.world.children) {
            const enemy = node.getComponent(EnemyController);
            if (!enemy) continue;
            if (enemy.isReadyToRemove) node.destroy();
            else if (enemy.isAlive) alive++;
        }

        const interval = Math.max(0.1, this.spawnInterval);
        this.timer += Math.max(0, deltaTime);
        if (this.timer < interval) return;
        this.timer %= interval;
        // 达到上限时不积攒生成次数；长时间切到后台也不会一次补出一群。
        if (alive >= Math.max(0, Math.floor(this.maxAlive))) return;
        this.spawnOne();
    }

    private spawnOne(): void {
        if (!this.enemyPrefab || !this.world || !this.hero) return;
        const node = instantiate(this.enemyPrefab);
        // 先配置位置和目标，再激活，保证 onLoad 时已经处于正确场景中。
        node.active = false;
        const enemy = node.getComponent(EnemyController);
        if (!enemy) {
            node.destroy();
            return;
        }
        const body = node.getComponent(CircleBody2D) ?? node.addComponent(CircleBody2D);
        const position = this.findSpawnPosition(node, body);
        if (!position) {
            // 没有安全出生点时跳过本次，不强行放在角色身上或地图外。
            node.destroy();
            return;
        }
        enemy.target = this.hero;
        node.setPosition(position.x, position.y, 0);
        this.world.addChild(node);
        // World 上的 WorldDepthSort 会按脚底高度排列英雄与新骷髅的遮挡顺序。
        node.active = true;
    }

    private findSpawnPosition(node: Node, body: CircleBody2D): Vec2 | null {
        const map = this.getMapBounds();
        const view = this.getViewBounds();
        if (!map || !view || !this.world || !this.hero) return null;
        const transform = node.getComponent(UITransform);
        const halfWidth = Math.max(body.worldRadius, (transform?.width ?? 0) * Math.abs(node.scale.x)
            * Math.max(transform?.anchorX ?? 0.5, 1 - (transform?.anchorX ?? 0.5)));
        const halfHeight = Math.max(body.worldRadius, (transform?.height ?? 0) * Math.abs(node.scale.y)
            * Math.max(transform?.anchorY ?? 0.5, 1 - (transform?.anchorY ?? 0.5)));
        const paddingX = halfWidth + Math.max(0, this.spawnMargin);
        const paddingY = halfHeight + Math.max(0, this.spawnMargin);

        // 最多尝试 30 个位置，随机选可见画面的四边。
        for (let attempt = 0; attempt < 30; attempt++) {
            const side = Math.floor(Math.random() * 4);
            let x = view.left + Math.random() * (view.right - view.left);
            let y = view.bottom + Math.random() * (view.top - view.bottom);
            if (side === 0) x = view.left - paddingX;
            else if (side === 1) x = view.right + paddingX;
            else if (side === 2) y = view.top + paddingY;
            else y = view.bottom - paddingY;

            // 整张精灵图片都必须在视口外，而不仅是中心点在外面。
            if (!(x + halfWidth <= view.left - Math.max(0, this.spawnMargin)
                || x - halfWidth >= view.right + Math.max(0, this.spawnMargin)
                || y + halfHeight <= view.bottom - Math.max(0, this.spawnMargin)
                || y - halfHeight >= view.top + Math.max(0, this.spawnMargin))) continue;

            // 图片和碰撞范围都留在地图内；接近地图边缘时，只使用可行方向。
            if (x - halfWidth < map.left || x + halfWidth > map.right
                || y - halfHeight < map.bottom || y + halfHeight > map.top) continue;
            if (Math.hypot(x - this.hero.position.x, y - this.hero.position.y) < Math.max(0, this.minHeroDistance)) continue;

            let overlaps = false;
            for (const sibling of this.world.children) {
                const other = sibling.getComponent(CircleBody2D);
                if (!other?.enabledInHierarchy) continue;
                // 小身体范围额外留 10 的出生间隙；追踪时可继续靠近至身体接触。
                if (body.overlapsAt(x, y, other, 10)) {
                    overlaps = true;
                    break;
                }
            }
            if (!overlaps) return new Vec2(x, y);
        }
        return null;
    }

    private getMapBounds(): Bounds | null {
        const transform = this.ground?.getComponent(UITransform);
        if (!transform || !this.ground) return null;
        const width = transform.width * Math.abs(this.ground.scale.x);
        const height = transform.height * Math.abs(this.ground.scale.y);
        const left = this.ground.position.x - width * transform.anchorX;
        const bottom = this.ground.position.y - height * transform.anchorY;
        return { left, right: left + width, bottom, top: bottom + height };
    }

    private getViewBounds(): Bounds | null {
        const camera = this.world?.parent?.getComponent(Canvas)?.cameraComponent;
        const worldTransform = this.world?.getComponent(UITransform);
        if (camera && worldTransform) {
            // 根据摄像机和实际渲染窗口换算视口，兼容浏览器尺寸、缩放与屏幕适配。
            const size = screen.windowSize;
            const rect = camera.rect;
            const bottomLeft = worldTransform.convertToNodeSpaceAR(camera.screenToWorld(
                new Vec3(rect.x * size.width, rect.y * size.height, 0)));
            const topRight = worldTransform.convertToNodeSpaceAR(camera.screenToWorld(
                new Vec3((rect.x + rect.width) * size.width, (rect.y + rect.height) * size.height, 0)));
            return { left: Math.min(bottomLeft.x, topRight.x), right: Math.max(bottomLeft.x, topRight.x),
                bottom: Math.min(bottomLeft.y, topRight.y), top: Math.max(bottomLeft.y, topRight.y) };
        }
        const viewport = this.world?.parent?.getComponent(UITransform);
        if (!viewport || !this.world) return null;
        // 当前场景 World 不旋转、缩放为正数；把 Canvas 可见区域换算到 World 本地坐标。
        const scaleX = Math.max(0.0001, this.world.scale.x);
        const scaleY = Math.max(0.0001, this.world.scale.y);
        const left = (-viewport.width * viewport.anchorX - this.world.position.x) / scaleX;
        const bottom = (-viewport.height * viewport.anchorY - this.world.position.y) / scaleY;
        return { left, right: left + viewport.width / scaleX, bottom, top: bottom + viewport.height / scaleY };
    }
}
