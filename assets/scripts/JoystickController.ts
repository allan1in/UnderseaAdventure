import { _decorator, Component, director, EventTouch, Game, game, instantiate, Node, resources, Sprite, SpriteFrame, UIOpacity, UITransform, Vec2, Vec3 } from 'cc';
import { HeroController } from './HeroController';
import { startBattle } from './BattleSession';
import { MusicDirector } from './MusicDirector';

const { ccclass, property, requireComponent, executionOrder } = _decorator;

@ccclass('JoystickController')
@executionOrder(-10)
@requireComponent(UITransform)
export class JoystickController extends Component {
    @property({ type: Node, tooltip: '把 Hierarchy 中的 Hero 节点拖到这里' })
    hero: Node | null = null;

    @property({ type: Node, tooltip: '把 Joystick 下的 Knob 节点拖到这里' })
    knob: Node | null = null;

    @property({ type: Node, tooltip: '接收按下的位置；留空自动使用父节点 Canvas，覆盖整个游戏视口' })
    inputArea: Node | null = null;

    @property({ tooltip: '主角每秒移动的距离' })
    moveSpeed = 200;

    @property({ tooltip: '圆钮离开摇杆中心的最大距离' })
    maxDistance = 50;

    @property({ tooltip: '中心附近的小范围不触发移动，避免轻微抖动' })
    deadZone = 6;

    private touchId: number | null = null;
    private readonly direction = new Vec2();
    private readonly touchPoint = new Vec3();
    private readonly localPoint = new Vec3();
    private inputNode: Node | null = null;
    private opacity: UIOpacity | null = null;
    private hint: Node | null = null;
    private hintKnob: Node | null = null;
    private hintHand: Node | null = null;
    private hasUsedJoystick = false;
    private hintElapsed = 0;
    private readonly onWindowBlur = (): void => this.resetJoystick();

    onLoad(): void {
        this.opacity = this.getComponent(UIOpacity) ?? this.addComponent(UIOpacity);
        this.resetJoystick();
        this.createHint();
    }

    onEnable(): void {
        this.resetJoystick();
        if (this.hint) this.hint.active = !this.hasUsedJoystick;
        this.inputNode = this.inputArea ?? this.node.parent;
        // Canvas 的触摸区域覆盖视口，鼠标事件由 Cocos 转成相同的触摸事件。
        // 使用节点事件，让上层 BlockInputEvents 遮罩仍能拦截输入。
        this.inputNode?.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.inputNode?.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.inputNode?.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.inputNode?.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        game.on(Game.EVENT_HIDE, this.resetJoystick, this);
        if (typeof window !== 'undefined') window.addEventListener('blur', this.onWindowBlur);
    }

    onDisable(): void {
        this.inputNode?.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.inputNode?.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.inputNode?.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.inputNode?.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.inputNode = null;
        game.off(Game.EVENT_HIDE, this.resetJoystick, this);
        if (typeof window !== 'undefined') window.removeEventListener('blur', this.onWindowBlur);
        this.resetJoystick();
        if (this.hint) this.hint.active = false;
    }

    update(deltaTime: number): void {
        this.updateHint(deltaTime);
        if (!this.hero) return;

        // deltaTime 是距上一帧经过的秒数，保证移动速度不依赖帧率。
        const distance = Math.max(0, this.moveSpeed) * deltaTime;
        const controller = this.hero.getComponent(HeroController);
        if (controller) {
            controller.move(
                this.touchId === null ? 0 : this.direction.x,
                this.touchId === null ? 0 : this.direction.y,
                distance,
            );
            return;
        }

        // 还没挂 HeroController 时，继续保留上一课的基本移动。
        if (this.touchId === null) return;
        const position = this.hero.position;
        this.hero.setPosition(
            position.x + this.direction.x * distance,
            position.y + this.direction.y * distance,
            position.z,
        );
    }

    private onTouchStart(event: EventTouch): void {
        if (this.touchId !== null || director.isPaused()) return;
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;
        // 按下点成为本次摇杆的固定中心；拖动时只移动圆钮。
        const point = event.getUILocation();
        this.touchPoint.set(point.x, point.y, 0);
        parentTransform.convertToNodeSpaceAR(this.touchPoint, this.localPoint);
        this.node.setPosition(this.localPoint.x, this.localPoint.y, this.node.position.z);
        this.touchId = event.getID();
        this.direction.set(0, 0);
        if (this.knob) this.knob.setPosition(0, 0, this.knob.position.z);
        if (this.opacity) this.opacity.opacity = 255;
        if (this.hint) this.hint.active = false;
        MusicDirector.startFromGesture(this.hero);
    }

    private createHint(): void {
        const canvas = this.node.parent, base = this.node.getChildByName('joystick-base');
        if (!canvas || !base || !this.knob) return;
        const hint = this.hint = new Node('JoystickHint'); hint.layer = this.node.layer;
        canvas.addChild(hint); hint.addComponent(UITransform).setContentSize(176, 196);
        const hintBase = instantiate(base); hint.addChild(hintBase);
        hintBase.setPosition(0, 0);
        this.hintKnob = instantiate(this.knob); hint.addChild(this.hintKnob);
        this.hintKnob.setPosition(0, 0);
        const hand = this.hintHand = new Node('DragHand'); hand.layer = this.node.layer; hint.addChild(hand);
        hand.addComponent(UITransform).setContentSize(100, 100); hand.setPosition(35, -40);
        const sprite = hand.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('gameplay/ad-ui/tutorial-hand/spriteFrame', SpriteFrame, (error, frame) => {
            if (!error && hand.isValid) sprite.spriteFrame = frame;
        });
        this.updateHint(0);
    }

    private updateHint(deltaTime: number): void {
        if (!this.hint || this.hasUsedJoystick) return;
        // 选卡和结算暂停期间隐藏引导，避免覆盖弹层。
        this.hint.active = !director.isPaused() && this.touchId === null;
        if (!this.hint.active) return;
        const canvas = this.hint.parent?.getComponent(UITransform);
        if (canvas) {
            this.hint.setPosition(canvas.width * (.5 - canvas.anchorX + .22),
                canvas.height * (.5 - canvas.anchorY - .18), 0);
        }
        this.hintElapsed += Math.max(0, deltaTime);
        const drag = (1 - Math.cos(this.hintElapsed * Math.PI)) / 2;
        const x = -24 * drag, y = 18 * drag;
        this.hintKnob?.setPosition(x, y);
        this.hintHand?.setPosition(35 + x, -40 + y);
    }

    onDestroy(): void { this.hint?.destroy(); }

    private onTouchMove(event: EventTouch): void {
        if (event.getID() !== this.touchId || director.isPaused()) return;
        this.updateDirection(event);
    }

    private onTouchEnd(event: EventTouch): void {
        if (event.getID() !== this.touchId) return;
        // Web 平台在触摸结束/鼠标抬起时补偿首次被浏览器拦截的播放请求。
        MusicDirector.startFromGesture(this.hero);
        this.resetJoystick();
    }

    private updateDirection(event: EventTouch): void {
        // 将屏幕上的触摸位置，换算成相对于 Joystick 中心的位置。
        const point = event.getUILocation();
        this.touchPoint.set(point.x, point.y, 0);
        this.getComponent(UITransform)!.convertToNodeSpaceAR(this.touchPoint, this.localPoint);

        const x = this.localPoint.x;
        const y = this.localPoint.y;
        const length = Math.hypot(x, y);
        const radius = Math.max(0, this.maxDistance);
        const ratio = length > 0 ? Math.min(1, radius / length) : 0;
        if (this.knob) this.knob.setPosition(x * ratio, y * ratio, this.knob.position.z);

        if (length <= Math.max(0, this.deadZone) || radius === 0) {
            this.direction.set(0, 0);
        } else {
            if (!this.hasUsedJoystick && this.hero) {
                startBattle(this.hero);
                this.hasUsedJoystick = true;
                if (this.hint) this.hint.active = false;
            }
            // 只取方向；归一化后，斜向移动不会比横向移动更快。
            this.direction.set(x / length, y / length);
        }
    }

    private resetJoystick(): void {
        this.touchId = null;
        this.direction.set(0, 0);
        // 只隐藏外观，Joystick 节点保持激活，组件才能继续监听下一次按下。
        if (this.opacity) this.opacity.opacity = 0;
        if (this.knob) this.knob.setPosition(0, 0, this.knob.position.z);
        if (this.hero?.isValid) this.hero.getComponent(HeroController)?.stopMoving();
    }
}
