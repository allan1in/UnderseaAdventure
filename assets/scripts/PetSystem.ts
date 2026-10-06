import { _decorator, Component, instantiate, Node, Prefab, Vec2 } from 'cc';
import { PetFollower } from './PetFollower';
import { CircleBody2D } from './CircleBody2D';

const { ccclass, property } = _decorator;

/** 海底伙伴对应原队列顺序；右到左显示前两项，选中后从队列移除。 */
export const PET_CATALOG = [
    { id: 'seahorse', cardScale: .845, x: 1.7017, y: -19.9303 },
    { id: 'turtle', cardScale: .845, x: 5.9566, y: -19.9303 },
    { id: 'jellyfish', cardScale: .585, x: -1.95195, y: -22.12405 },
    { id: 'shark', cardScale: .455, x: 1.5535, y: -19.9303 },
];

@ccclass('PetSystem')
export class PetSystem extends Component {
    @property(Node)
    hero: Node | null = null;

    @property(Node)
    ground: Node | null = null;

    @property({ type: [Prefab], tooltip: '海底候选队列：海马、海龟、水母、鲨鱼' })
    petPrefabs: Prefab[] = [];

    @property({ type: [Vec2], tooltip: '只在招募时使用的出生偏移，不是持续跟随的目标位置' })
    spawnOffsets: Vec2[] = [new Vec2(-75, 75), new Vec2(-75, -5), new Vec2(-150, 33.9435)];

    private selected = new Set<number>();
    private pets: Node[] = [];

    get recruitedCount(): number { return this.pets.length; }

    onLoad(): void {
        this.hero ??= this.node.getChildByName('Hero');
        this.ground ??= this.node.getChildByName('Ground');
    }

    getCandidates(): number[] {
        return this.petPrefabs.map((_, index) => index).filter(index => !this.selected.has(index)).slice(0, 2);
    }

    private findSpawnPosition(follower: PetFollower): Vec2 | null {
        if (!this.hero) return null;
        const offset = this.spawnOffsets[Math.min(this.pets.length, this.spawnOffsets.length - 1)] ?? new Vec2(-100, 0);
        const body = follower.getComponent(CircleBody2D);
        if (!body) return null;
        body.collisionGroup = 2; body.collisionMask = 2;
        const preferred = follower.clampToMap(this.hero.position.x + offset.x, this.hero.position.y + offset.y);
        if (body.canOccupy(preferred.x, preferred.y)) return preferred;
        const startAngle = Math.atan2(offset.y, offset.x);
        for (let ring = 1; ring <= 20; ring++) {
            const radius = Math.max(Math.hypot(offset.x, offset.y), body.worldRadius + 30) + ring * 60;
            for (let spoke = 0; spoke < 24; spoke++) {
                const angle = startAngle + spoke * Math.PI / 12;
                const point = follower.clampToMap(this.hero.position.x + Math.cos(angle) * radius,
                    this.hero.position.y + Math.sin(angle) * radius);
                if (body.canOccupy(point.x, point.y)) return point;
            }
        }
        return null;
    }

    recruit(index: number): Node | null {
        if (!this.hero?.isValid || this.getCandidates().indexOf(index) < 0) return null;
        const prefab = this.petPrefabs[index];
        if (!prefab) return null;
        const node = instantiate(prefab);
        node.active = false;
        const follower = node.getComponent(PetFollower);
        if (!follower) { node.destroy(); return null; }
        follower.target = this.hero;
        follower.ground = this.ground;
        this.node.addChild(node);
        const position = this.findSpawnPosition(follower);
        if (!position) { node.destroy(); return null; }
        node.setPosition(position.x, position.y, 0);
        this.selected.add(index);
        this.pets.push(node);
        node.active = true;
        this.node.emit('pet-recruited', index);
        return node;
    }

    onDestroy(): void {
        for (const node of this.pets) if (node.isValid) node.destroy();
        this.pets = [];
    }
}
