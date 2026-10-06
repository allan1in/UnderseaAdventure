import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

/** 仅用于兼容编辑器缓存的旧 Prefab；Boss 攻击不再显示贴图特效。 */
@ccclass('BossAttackEffects')
export class BossAttackEffects extends Component {
    onLoad(): void {
        for (const child of [...this.node.children]) {
            if (/^Attack(?:Sweep\d*|Hit|Telegraph)$/.test(child.name)) child.destroy();
        }
        this.destroy();
    }
}
