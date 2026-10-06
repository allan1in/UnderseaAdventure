import { _decorator, Button, Component, director, Director, Node, UIOpacity, UITransform, Widget } from 'cc';
import { FlatShape } from './FlatShape';

const { ccclass, property } = _decorator;
type InstallHost = { $soyooFacadeImpl?: { onGameInstall?: () => void } };

/** 广告 UI 独立于战斗：结算内容直接显示，暂停期间仍推进下载手势。 */
@ccclass('AdPresentation')
export class AdPresentation extends Component {
    @property(Node) hud: Node | null = null;
    @property(Node) hudDownload: Node | null = null;
    @property(Node) resultDownload: Node | null = null;
    @property(Node) resultOverlay: Node | null = null;
    @property(Node) resultPanel: Node | null = null;
    @property(Node) downloadHand: Node | null = null;
    @property({ type: [Node], displayName: '结算显示内容' }) fadeViews: Node[] = [];
    @property({ tooltip: '无广告平台安装接口时使用的下载地址；未配置则发出 playable-download-request 事件' }) downloadUrl = '';

    private resultStartedAt = 0;
    private handX = 0;
    private handY = 0;
    private viewWidth = -1;
    private viewHeight = -1;

    onLoad(): void {
        if (this.hud) this.hud.active = true;
        if (this.downloadHand) {
            this.handX = this.downloadHand.position.x; this.handY = this.downloadHand.position.y;
            this.downloadHand.getComponent(UITransform)?.setContentSize(100, 100);
        }
    }

    onEnable(): void {
        this.hudDownload?.on(Button.EventType.CLICK, this.downloadFromHUD, this);
        this.resultDownload?.on(Button.EventType.CLICK, this.downloadFromResult, this);
        this.node.on('battle-complete', this.showResult, this);
        director.on(Director.EVENT_BEFORE_DRAW, this.animatePresentation, this);
    }

    onDisable(): void {
        this.hudDownload?.off(Button.EventType.CLICK, this.downloadFromHUD, this);
        this.resultDownload?.off(Button.EventType.CLICK, this.downloadFromResult, this);
        this.node.off('battle-complete', this.showResult, this);
        director.off(Director.EVENT_BEFORE_DRAW, this.animatePresentation, this);
    }

    private showResult(): void {
        if (this.hud) this.hud.active = false;
        this.resultStartedAt = Date.now();
        for (const node of this.fadeViews) {
            (node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)).opacity = 255;
        }
        this.animatePresentation();
    }

    private animatePresentation(): void {
        // 神灯会将选卡遮罩提到最前；常驻入口仍需显示并接收点击。
        if (this.hud?.active && this.hud.getSiblingIndex() !== this.node.children.length - 1) {
            this.hud.setSiblingIndex(this.node.children.length - 1);
        }
        const view = this.node.getComponent(UITransform);
        if (view && (view.width !== this.viewWidth || view.height !== this.viewHeight)) {
            this.viewWidth = view.width; this.viewHeight = view.height;
            this.hud?.getComponent(Widget)?.updateAlignment();
            for (const child of this.hud?.children ?? []) child.getComponent(Widget)?.updateAlignment();
            this.resultOverlay?.getComponent(UITransform)?.setContentSize(view.contentSize);
            this.resultOverlay?.getComponent(FlatShape)?.redraw();
            const fit = Math.max(.1, Math.min(1, (view.width - 30) / 640, (view.height - 30) / 570));
            this.resultPanel?.setScale(fit, fit, 1);
        }
        if (!this.resultOverlay?.activeInHierarchy || !this.resultStartedAt) return;
        const elapsed = Math.max(0, (Date.now() - this.resultStartedAt) / 1000);
        // director.pause 冻结人物与计时；绘制前只更新手势 UI。
        if (this.downloadHand) {
            const pulse = (1 - Math.cos(elapsed * Math.PI * 2)) / 2;
            this.downloadHand.setPosition(this.handX, this.handY + pulse * 9, 0);
            this.downloadHand.setScale(1 - pulse * .08, 1 - pulse * .08, 1);
        }
    }

    private downloadFromHUD(): void { this.requestDownload('hud'); }
    private downloadFromResult(): void { this.requestDownload('result'); }

    private requestDownload(source: 'hud' | 'result'): void {
        const host = globalThis as unknown as InstallHost;
        const install = host.$soyooFacadeImpl?.onGameInstall;
        if (typeof install === 'function') { install.call(host.$soyooFacadeImpl); return; }
        if (this.downloadUrl && typeof window !== 'undefined') { window.open(this.downloadUrl, '_blank', 'noopener,noreferrer'); return; }
        const detail = { source };
        this.node.emit('download-request', detail);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('playable-download-request', { detail }));
        console.info('[Playable] download request', source);
    }
}
