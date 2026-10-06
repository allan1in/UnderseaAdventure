import { _decorator, Color, Component, Graphics, UITransform } from 'cc';

const { ccclass, executeInEditMode, requireComponent, property } = _decorator;

/** 小型纯色 UI：在场景编辑器和运行时都显示，可直接调整节点尺寸与颜色。 */
@ccclass('FlatShape')
@executeInEditMode
@requireComponent(Graphics)
export class FlatShape extends Component {
    @property(Color)
    color = new Color(255, 255, 255, 255);

    @property
    radius = 0;

    @property
    ellipse = false;

    private lastShape = '';

    onLoad(): void { this.redraw(); }
    onEnable(): void { this.redraw(); }
    lateUpdate(): void { this.redraw(); }

    redraw(): void {
        const transform = this.getComponent(UITransform);
        const graphics = this.getComponent(Graphics);
        if (!transform || !graphics) return;
        const { width, height, anchorX, anchorY } = transform;
        const key = `${width},${height},${anchorX},${anchorY},${this.color.toHEX('#rrggbbaa')},${this.radius},${this.ellipse}`;
        if (key === this.lastShape) return;
        this.lastShape = key;
        graphics.clear();
        if (width <= 0 || height <= 0) return;
        graphics.fillColor = this.color;
        const x = -width * anchorX, y = -height * anchorY;
        if (this.ellipse) graphics.ellipse(x + width / 2, y + height / 2, width / 2, height / 2);
        else if (this.radius > 0) graphics.roundRect(x, y, width, height, Math.min(this.radius, width / 2, height / 2));
        else graphics.rect(x, y, width, height);
        graphics.fill();
    }
}
