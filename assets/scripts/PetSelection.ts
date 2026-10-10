import { _decorator, Button, Component, director, Director, Node, sp, Sprite, SpriteFrame, UITransform } from 'cc';
import { PET_CATALOG, PetSystem } from './PetSystem';
import { SoundEffects } from './SoundEffects';
import { PetFollower } from './PetFollower';

const { ccclass, property } = _decorator;

// 当前卡片首帧的实心轮廓 [左, 上, 宽, 高]；顺序与 PET_CATALOG 一致。
const CARD_PET_BOUNDS = [
    [129, 57, 157, 224],
    [48, 97, 238, 168],
    [22, 31, 207, 220],
    [155, 225, 237, 147],
];

@ccclass('PetSelection')
export class PetSelection extends Component {
    @property(PetSystem)
    petSystem: PetSystem | null = null;

    @property(Node)
    panel: Node | null = null;

    @property(Node)
    leftCard: Node | null = null;

    @property(Node)
    rightCard: Node | null = null;

    @property({ type: [SpriteFrame], tooltip: '按伙伴队列顺序配置四种海底卡片底板' })
    themeCardFrames: SpriteFrame[] = [];

    @property({ tooltip: '所有宠物可见轮廓统一适配的正方形边长' })
    cardPetSize = 145;

    private candidates: number[] = [];
    private choosing = false;
    private openedAt = 0;
    private lastTick = 0;

    onEnable(): void {
        this.choosing = false;
        this.candidates = this.petSystem?.getCandidates() ?? [];
        this.configureCard(this.rightCard, this.candidates[0]);
        this.configureCard(this.leftCard, this.candidates[1]);
        this.leftCard?.on(Button.EventType.CLICK, this.chooseLeft, this);
        this.rightCard?.on(Button.EventType.CLICK, this.chooseRight, this);
        this.openedAt = this.lastTick = Date.now();
        director.on(Director.EVENT_BEFORE_DRAW, this.updatePresentation, this);
        this.updatePresentation();
    }

    onDisable(): void {
        this.leftCard?.off(Button.EventType.CLICK, this.chooseLeft, this);
        this.rightCard?.off(Button.EventType.CLICK, this.chooseRight, this);
        director.off(Director.EVENT_BEFORE_DRAW, this.updatePresentation, this);
    }

    private configureCard(card: Node | null, index: number | undefined): void {
        if (!card) return;
        card.active = index !== undefined;
        if (index === undefined) return;
        const preview = card.getChildByName('Pet');
        const sourceVisual = this.petSystem?.petPrefabs[index]?.data.getChildByName('Visual');
        const sourcePicture = sourceVisual?.getChildByName('Sprite');
        const themeFrame = sourcePicture?.getComponent(Sprite)?.spriteFrame;
        const renderer = preview?.getComponent(Sprite);
        const cardRenderer = card.getComponent(Sprite);
        if (cardRenderer && this.themeCardFrames[index]) cardRenderer.spriteFrame = this.themeCardFrames[index];
        const follower = this.petSystem?.petPrefabs[index]?.data.getComponent(PetFollower);
        const petRig = follower?.petSkeleton;
        const oldSkeleton = preview?.getComponent(sp.Skeleton);
        let rigView = preview?.getChildByName('Rig');
        if (petRig && preview) {
            if (renderer) renderer.enabled = false;
            if (oldSkeleton) oldSkeleton.enabled = false;
            if (!rigView) { rigView = new Node('Rig'); rigView.layer = preview.layer; preview.addChild(rigView); rigView.addComponent(UITransform); }
            rigView.active = true;
            const skeleton = rigView.getComponent(sp.Skeleton) ?? rigView.addComponent(sp.Skeleton);
            skeleton.enabled = true; skeleton.premultipliedAlpha = false; skeleton.skeletonData = petRig;
            // 按每只宠物的可见轮廓适配卡片，忽略贴图透明留白。
            const fit = Math.max(1, this.cardPetSize) / Math.max(1, follower?.skeletonCardSize ?? 167);
            preview.setScale(fit, fit, 1);
            preview.setPosition((follower?.skeletonCardOffsetX ?? -10) * fit, (follower?.skeletonCardOffsetY ?? 7) * fit, 0);
            skeleton.setAnimation(0, 'Idle', true); skeleton.updateAnimation(0);
            const button = card.getComponent(Button); if (button) button.interactable = true;
            return;
        }
        if (rigView) rigView.active = false;
        if (oldSkeleton) oldSkeleton.enabled = false;
        if (renderer) renderer.enabled = true;
        if (preview && renderer && themeFrame && sourcePicture) {
            renderer.spriteFrame = themeFrame;
            renderer.sizeMode = Sprite.SizeMode.CUSTOM;
            renderer.trim = false;
            const previewUI = preview.getComponent(UITransform);
            if (previewUI) {
                const size = themeFrame.originalSize;
                const [left, top, width, height] = CARD_PET_BOUNDS[index] ?? [0, 0, size.width, size.height];
                const fit = Math.max(1, this.cardPetSize) / Math.max(width, height);
                // 忽略透明留白，统一可见轮廓的最长边，保留每只宠物的宽高比例。
                previewUI.setContentSize(size.width * fit, size.height * fit);
                previewUI.setAnchorPoint((left + width / 2) / size.width, 1 - (top + height / 2) / size.height);
            }
            preview.setScale(1, 1, 1);
            preview.setPosition(0, 0, 0);
            const button = card.getComponent(Button);
            if (button) button.interactable = true;
            return;
        }
        const skeleton = preview?.getComponent(sp.Skeleton);
        const source = this.petSystem?.petPrefabs[index]?.data.getChildByName('Visual')?.getChildByName('Spine')?.getComponent(sp.Skeleton);
        const config = PET_CATALOG[index];
        if (skeleton && source?.skeletonData && preview && config) {
            skeleton.premultipliedAlpha = false;
            skeleton.skeletonData = source.skeletonData;
            preview.setScale(config.cardScale, config.cardScale, 1);
            preview.setPosition(config.x, config.y, 0);
            skeleton.setAnimation(0, 'Idle', true);
            skeleton.updateAnimation(0);
        }
        const button = card.getComponent(Button);
        if (button) button.interactable = true;
    }

    private chooseLeft(): void { this.choose(this.candidates[1]); }
    private chooseRight(): void { this.choose(this.candidates[0]); }

    private choose(index: number | undefined): void {
        if (this.choosing || index === undefined || !this.petSystem?.recruit(index)) return;
        this.choosing = true;
        SoundEffects.play('shop-buy');
        for (const card of [this.leftCard, this.rightCard]) {
            const button = card?.getComponent(Button);
            if (button) button.interactable = false;
        }
        this.node.emit('pet-selected', index);
    }

    private updatePresentation(): void {
        const now = Date.now();
        const elapsed = Math.min(.05, Math.max(0, (now - this.lastTick) / 1000));
        this.lastTick = now;
        // director.pause 冻结战斗；绘制前仅更新卡牌 UI，不推进世界中的宠物。
        if (director.isPaused()) for (const card of [this.leftCard, this.rightCard]) {
            if (card?.active) {
                const preview = card.getChildByName('Pet');
                const rigView = preview?.getChildByName('Rig');
                const skeleton = rigView?.active ? rigView.getComponent(sp.Skeleton) : preview?.getComponent(sp.Skeleton);
                skeleton?.updateAnimation(elapsed);
            }
        }
        const canvas = this.node.getComponent(UITransform);
        if (this.panel && canvas) {
            const panelSize = this.panel.getComponent(UITransform);
            const fit = Math.max(.1, Math.min(1, (canvas.width - 40) / (panelSize?.width || 438),
                (canvas.height - 40) / (panelSize?.height || 275.6)));
            const t = Math.min(1, Math.max(0, (now - this.openedAt) / 180));
            const pop = .75 + .25 * (1 - Math.pow(1 - t, 3));
            this.panel.setScale(fit * pop, fit * pop, 1);
        }
    }
}
