# 项目协作说明

- 不到万不得已，不要使用 computer use。
- 仅修改 UnderseaAdventure；保留原 mushroom 项目。
- 保留素材 .meta UUID，避免资源引用失效。
- 以下内容从原 README 完整迁入，包含历史实现与验证记录。历史状态可能已过时，以当前代码、场景及用户最新要求为准。

---

## 当前压缩与线上加载（2026-10-07）

`tools/build-and-pack.ps1` 需要 Node.js、Python 与 Pillow。打包保留 `build/undersea-adventure-full.html` 原版，并输出压缩单文件 `build/undersea-adventure-single.html`；`tools/prepare-vercel.py` 仅压缩构建副本的图片颜色，保持游戏贴图尺寸与透明通道，原始 `assets/` 不变。

线上发布目录为 `build/vercel-mobile`。根页面内嵌轻量加载界面，游戏资源放在内容哈希目录，按真实 Cocos 预加载进度更新；加载缓慢或失败时显示重试按钮。不要再将巨大的单文件作为线上首个响应。`tools/check-mobile-deployment.cjs <URL>` 验证手机视口、限速网络、首次加载与触屏移动；该模拟结果不等于实体手机验证。

# Undersea Adventure · 海底冒险

从 `mushroom` 复制的独立 Cocos 项目，项目名称为 `UnderseaAdventure`。已接入主题素材目录中的 37 张运行时图片，玩法沿用原工程。首次打开会重新生成导入缓存；资源和 `.meta` 引用保持完整。

Cocos Creator 3.8.8，2D，设计分辨率 1280 × 720。

## 最新加载页与开场引导

`preview-template/` 和 `build-templates/web-mobile`、`build-templates/web-desktop` 使用统一海底加载页，包含现有 Logo、英雄、伙伴、气泡及真实资源进度。首次新增预览模板后需保存场景并重启 Cocos 编辑器，刷新已启动的预览服务器仍会使用缓存的模板。

开场在屏幕中心偏右下显示与真实摇杆等大的摇杆及拖动手势，不显示文字；首次唤出摇杆后永久隐藏本局提示。手指已替换为主题素材中的 `tutorial-hand-v2.png`，下载手势同样使用新图。Boss 攻击贴图特效和范围预警已移除，保留角色攻击动画、伤害、音效及出场预警。

素材更新工具：`tools/import-tutorial-hand.py` 替换共享手指；`tools/sync-loading-templates.py` 将加载页素材和样式同步到网页模板。

## 当前海底主角外观（2026-10-05）

主角四个进化形态已接入 `assets/textures/characters/sea-hero/hero-stage-01.png` 至 `hero-stage-04.png`，原图为 1254 × 1254，保留透明通道和完整画布。显示高度依次约为 120、135、150、165，脚底统一落在 Hero 下方 56，图片只围绕身体轴翻转，血条位于头顶上方。HeroEvolution 的 `themeFrames` 保存四张 SpriteFrame，`forms.json` 的 `themeVisual` 保存显示校准；第四形态也使用新静态外观。

当前图片仅有一个姿势：待机、走路和攻击片段重复同一张图来保留计时，尚未制作海底角色动作帧或骨骼动画。移动、攻击判定、挥砍特效、三次进化、生命和伤害参数沿用原玩法；小兵、Boss 和四种伙伴已替换为螃蟹、章鱼、海马、海龟、水母及鲨鱼的静态外观。旧素材、动作文件及最终形态 Spine 保留，便于后续制作动画或回退。历史迁移工具和备份已按要求清理。

验证：TypeScript 项目代码检查通过（`--skipLibCheck` 跳过 Cocos 自带声明问题）；清理前使用 Cocos 测试替身核对了四个外观、三次进化、最终形态攻击计时、显示校准和未涉及对象；验证脚本已删除。该段为主角接入时的历史验证记录。下方原工程动画说明用于记录旧素材实现，以本节说明为准。

## 现有主题素材接入（2026-10-05）

本次仅使用 `../主题素材/海底冒险` 已有 PNG，未生成或修改图片内容。原 mushroom 项目保留。

- 背景及四阶段主角沿用已接入版本。
- 四种伙伴使用静态 Sprite，原招募、跟随、攻击和碰撞逻辑继续运行。旧 Prefab 文件名保留以维护引用，队列顺序为海马、海龟、水母、鲨鱼。
- 选卡按对应伙伴叠加独立图片与橙金、绿色、粉紫、蓝色底板；根据当前面板尺寸适配屏幕。
- 累计战斗 60 秒显示章鱼头像预警横幅，持续 2 秒，选卡暂停不计时；提示不再等待 Boss 找到出生位置。BossWarning 节点会自动关联，并在显示时移至 UI 上层。
- 螃蟹走路、攻击和死亡片段重复唯一姿势，保留原片段时长；章鱼保留原攻击和死亡计时，不再显示旧 Boss 动作帧。
- 贝壳货币用于掉落、余额图标和投币；扇贝替代神灯，金币飞入珍珠位置，进度条移至装置上方。
- 四类小点缀均匀分布于地图，共 36 个独立背景节点；不会增加碰撞。
- 线路指引使用海底金色箭头，保持原来的排列和旋转方向。
- 胜利和失败结算标题已移除；结算保留 Logo、下载按钮及手势，胜负判定继续运行。
- 浮动摇杆替换海蓝底盘与珍珠摇杆头；常驻和结算 Logo 使用 UNDERSEA HEROES 新图，下载按钮使用自带 DOWNLOAD 文字的新图。

图片显示尺寸按透明画布和实体范围校准，保留原始 PNG。没有对应主题文件的音效及攻击特效沿用现有资源。角色素材仅包含静态姿势；本次没有制作动作动画。下方关于旧 Spine、黑龙和广告 UI 的历史说明记录原工程实现，以本节为准。

按用户要求，本次已停止后续检查，最终显示效果由用户在 Cocos 中确认。

## 打开当前版本

1. 回到 Cocos，等待 Assets 的资源导入和脚本编译完成。
2. 如果正在编辑动画或 Prefab，先保存，再点场景视图中的 **Close**。
3. 在 Assets 展开 `scenes`，双击 **Main.scene**。
4. 在 Hierarchy 展开 Canvas、World、Hero，查看下方列出的节点。
5. 点击编辑器顶部的 ▶，打开新的浏览器预览。旧预览页先关闭，避免看到旧场景。
6. 在游戏画面任意位置按住并拖动，唤出浮动摇杆并移动；松开隐藏。击杀螃蟹、拾取贝壳金币，再沿黄色箭头靠近扇贝召唤装置。观察右上余额减少、神灯进度增加，满额后出现两张宠物卡牌并暂停。
7. 点击一张卡牌，宠物出现，英雄同时进化到下一形态并回满血，遮罩关闭、游戏继续，箭头指向下一盏神灯。离开宠物后它会跟上；靠近英雄后待机。第三次选择完成后保留三只宠物，英雄达到最终形态，神灯和指引结束。
8. 累计运行 60 秒出现 Boss 警告和章鱼；选卡暂停不计时，不需要先选满三只宠物。击败 Boss 显示胜利，英雄血量归零显示失败；结算后保持暂停，不显示重玩按钮。
9. 开场至战斗期间左上显示 Logo、右下显示 DOWNLOAD；选卡时保留。结算隐藏角落版本，显示大 Logo、下载按钮及动态手势。

**不需要重新拖动素材或关联字段。** 新场景已经保存了节点、组件、动画、Spine 数据和 Prefab 引用。

如果 Assets 没出现新场景，或 Console 提示新增脚本/Prefab 尚未导入，保存当前编辑内容后关闭并重新打开 UnderseaAdventure 项目，再执行第 3 步。

按用户要求，全部修改合并到 Main.scene，学习工程的 assets 中只保留这个场景；MainRefactored.scene 已删除。Main 的原 UUID 保留。重新打开磁盘上的 Main 后再预览，避免编辑器中仍停留在已删除的场景或旧的内存版本。所有后续学习继续修改 Main。

## 场景节点

```text
Main
└── Canvas
    ├── Camera
    ├── World
    │   ├── Ground
    │   │   └── Seafloor-r01-c01 ～ Seafloor-r03-c03（3 × 3 重复背景）
    │   ├── Hero
    │   │   ├── Shadow
    │   │   ├── GroundRing
    │   │   ├── Visual
    │   │   │   ├── Sprite（前三种形态）
    │   │   │   └── Spine（最终形态，初始隐藏）
    │   │   ├── HealthBar
    │   │   │   └── Fill
    │   │   └── UpgradeEffect（进化时播放，初始隐藏）
    │   ├── EnemySpawner
    │   ├── MagicLamp
    │   │   ├── Shadow
    │   │   ├── Spine
    │   │   └── CoinProgress
    │   │       ├── Fill
    │   │       └── Amount
    │   └── LampGuide
    ├── Joystick
    │   ├── joystick-base
    │   └── joystick-knob
    ├── CoinHUD
    │   ├── CoinIcon
    │   └── Total
    ├── AdHUD（结算时隐藏）
    │   ├── Logo
    │   └── Download
    │       └── DownloadText
    ├── LampSelectionOverlay（默认隐藏）
        └── Panel
            ├── CardLeft
            │   └── Pet
            └── CardRight
                └── Pet
    ├── BossWarning（默认隐藏）
    └── BattleResultOverlay（默认隐藏）
        └── Panel
            ├── Logo
            ├── Win / Lose
            ├── Download
            │   └── DownloadText
            └── DownloadHand
```

| 节点 | 用途 | 主要组件 |
| --- | --- | --- |
| Canvas | 屏幕布局的根节点 | Canvas、UITransform、Widget |
| Camera | 把场景渲染到游戏画面 | Camera |
| World | 地图坐标空间；跟随英雄滚动 | WorldDepthSort、CoinSystem、MagicLampSystem、PetSystem、BossBattleSystem |
| Ground | 地图边界；9 个子节点重复铺设 4K 海底背景 | UITransform |
| Hero | 英雄身体中心，控制位置、碰撞、攻击与招募后的形态升级 | HeroController、HeroVisual、HeroHealth、HeroEvolution、CircleBody2D |
| Hero/Shadow、GroundRing | 独立的脚下阴影和原宠物黄色圈；不随角色翻转 | FlatShape / Sprite |
| Visual | 围绕身体中心翻转角色外观 | UITransform |
| Visual/Sprite | 显示图片和播放待机、走路、攻击动画 | Sprite、Animation |
| Hero/Visual/Spine | 第四形态使用原骨骼素材；轨道 0 待机/走路，轨道 1 攻击 | sp.Skeleton |
| Hero/UpgradeEffect | 播放原示例的升级光效，结束后隐藏 | Sprite、Animation |
| HealthBar / Fill | 固定在身体上方的血条；Fill 从右侧缩短 | FlatShape、Graphics |
| EnemySpawner | 保存刷怪配置并创建 Enemy 实例 | EnemySpawner |
| MagicLamp | 当前神灯的世界位置 | UITransform |
| Shadow | 神灯的地面阴影 | FlatShape、Graphics |
| Spine | 金色神灯的骨骼动画 | sp.Skeleton |
| CoinProgress | 神灯进度背景 | FlatShape、Graphics |
| CoinProgress/Fill | 投币后的蓝色填充 | FlatShape、Graphics |
| Amount | 神灯进度文字，例如 1/10 | Label |
| LampGuide | 管理朝向神灯的箭头实例 | LampGuide |
| Joystick | 在屏幕按下位置显示，接收拖动输入；松开隐藏 | JoystickController、UIOpacity |
| CoinHUD | 固定在屏幕右上角 | Widget、FlatShape、Graphics |
| CoinIcon / Total | 金币图标及可花费余额 | Sprite / Label |
| LampSelectionOverlay | 满额后遮罩、输入拦截与二选一 | Widget、FlatShape、Graphics、BlockInputEvents、PetSelection |
| Panel | 两张卡片整体居中、弹出和尺寸适配 | UITransform |
| CardLeft / CardRight | 显示原卡片背景并处理点击 | Sprite、Button |
| CardLeft/Pet、CardRight/Pet | 播放候选宠物的原 Spine 待机动画 | sp.Skeleton |
| BossWarning | Boss 出场时播放原提示动画 | sp.Skeleton |
| AdHUD/Logo、Download | 常驻左上 Logo 和右下下载按钮，按屏幕边缘适配 | Sprite、Widget / Button、BlockInputEvents |
| Canvas/AdPresentation | 管下载入口、结算渐显与暂停期间的手势动画 | AdPresentation |
| BattleResultOverlay/Panel/Download、DownloadHand | 结算大下载按钮与指示手势 | Button、Sprite |
| BattleResultOverlay | 胜负遮罩、结果和重玩按钮 | FlatShape、BlockInputEvents、Button |

背景引用 `assets/textures/ground/background-seafloor-seamless-4k.png`，与 `../主题素材/海底冒险/textures/ground/background-seafloor-seamless-4k.png` 内容一致。4096 × 4096 的同一张图片由 9 个 Sprite 共享，按 3 × 3 重复铺设；每块显示约为 944.1667 × 944.1667，采用固定坐标排列。Ground 的 2832.5 × 2832.5 尺寸、锚点、位置及玩法引用保持不变。素材和工程的 ground 目录仅保留 4K 图片及工程必需的 .meta；其他背景和旧草地图片已删除。历史 tools 目录、迁移脚本和场景备份已按要求清理。已校验 9 块排列、资源引用和地图边界，用户实际预览确认看不出接缝。

FlatShape 是一个很小的自定义显示组件：根据 UITransform 的尺寸，用 Graphics 画纯色矩形、圆角矩形或椭圆。它也在编辑模式运行，所以血条、进度背景和金币栏背景在编辑器里可见；游戏玩法组件不会因此在编辑器里运行。

World 中的 Hero、Enemy 实例、MagicLamp 和招募的宠物保持同一级，按脚底高度排序。不要直接给它们再套一层父节点：目前碰撞、索敌和排序使用共同的 World 坐标。

## 动态对象与 Prefab

`assets/prefabs` 中有八个模板：

| Prefab | 谁创建实例 | 用途 |
| --- | --- | --- |
| Enemy | EnemySpawner | 骷髅移动、攻击、死亡 |
| Coin | CoinSystem / MagicLampSystem | 死亡掉落金币，以及投入神灯时的飞行金币 |
| GuideArrow | LampGuide | 黄色方向箭头，实例会复用 |
| SlashEffect | HeroController | 挥砍时的剑弧，实例会复用 |
| PetRedDragon / PetFox / PetWhiteTiger / PetBlueDragon | PetSystem | 红龙、狐狸、白虎、蓝龙；包含 Visual/Spine、地面光圈、PetFollower 和 PetAttack，无身体阻挡 |
| PetRedDragonHit / PetFoxHit / PetWhiteTigerHit / PetBlueDragonHit | PetAttack | 各宠物的命中序列帧与音效；运行时实例复用，自动消失 |

Prefab 是模板，游戏中的每枚金币或每只骷髅是它的实例。静态界面不用每次开局重新拼装；数量和位置变化的对象在运行时实例化。

### 怎样修改外观

1. 修改固定对象：在 Hierarchy 选中对应节点，例如 CoinHUD/Total 或 MagicLamp/Spine。
2. 修改动态对象：在 Assets/prefabs 双击模板，修改其中的 Sprite、Animation 等组件。
3. 保存；如果进入了 Prefab 编辑模式，点 **Save** 后再点 **Close** 回到场景。
4. 保存场景，重新开启预览检查。

修改金币贴图，在 Coin.prefab 的 Sprite 子节点选择 Sprite Frame。新场景以 Prefab 的贴图为准，运行时也会同步到金币栏图标；CoinSystem 的 Coin Frame 留给旧场景兼容。金币显示宽度仍由 CoinSystem 的 Coin Size 管理，路径箭头宽度由 LampGuide 的 Spacing 管理，挥砍动作仍由 HeroController 的 Slash Clip 管理。

修改颜色时，可直接选中 FlatShape 节点调整 Color；UITransform 管理宽高。血条 Fill 宽度由血量计算、神灯 Fill 宽度由投币进度计算，运行时会覆盖手动填写的宽度。

Hero 的外观应在 Visual/Sprite 上调整；身体位置与碰撞在 Hero 上调整。血条放在 Hero 下，因此不会跟着 Visual 左右翻转。

查看选择界面时，可临时勾选 LampSelectionOverlay 节点左上角的激活复选框，查看完取消勾选再保存；正式游戏由 MagicLampSystem 在满额时显示。调整卡片位置和背景，选 Panel/CardLeft、CardRight；调整宠物实际游戏外观，编辑相应 Pet Prefab 的 Visual/Spine。卡片预览比例和位置来自原示例，由 PetSystem.ts 的 PET_CATALOG 配置；运行时会覆盖卡片 Pet 子节点的这些属性。

## 宠物候选与跟随

从原 HTML 的 UI_Shop、PlayerPetController、PetController 和场景配置核对：候选不是随机抽取，而是固定队列 **红龙 → 狐狸 → 白虎 → 蓝龙**。每次拿剩余队列前两项，第一项在右，第二项在左；选中的从队列移除，没选的保留。

- 首轮：左狐狸、右红龙。
- 首轮选狐狸：次轮左白虎、右红龙；首轮选红龙：次轮左白虎、右狐狸。
- 第三轮：左蓝龙、右前两轮剩下的一只。三盏神灯对应三次选择，四种宠物最多招募三种，没有重复。
- PetSelection 负责候选显示/点击和卡片动画；PetSystem 管理队列与 Prefab 实例；PetFollower 管理单只宠物的跟随/待机/左右朝向；MagicLampSystem 接收选择完成事件，推进阶段和恢复游戏。
- 按用户最新要求，取消固定队形，恢复直接向英雄跟随。距英雄超过 100 才靠近，到达范围后留在原地待机；英雄在附近小幅移动时宠物不会同步平移。每 0.1 秒检查状态，移动速度 300；PetFollower 中的 Idle Range / Move Speed 可调整。大宠物受地图边缘限制时，停止距离至少为合法位置到英雄的距离，避免在边角反复挪动。
- Spawn Offsets 使用原三个出生偏移的 0.5 倍，只在招募时使用，不作为持续目标。出生点限制在地图内，并检查其它宠物占位；若已占用，在英雄附近找空位。
- 红龙、狐狸、白虎使用原 Idle/Move；蓝龙原资源只有 Idle，移动时继续该动画。资源已复制到 assets/resources/gameplay/pets，Spine 配套文件保持原名和字节内容。
- 对原示例重新核对后，四个 Pet Prefab 使用独立的宠物碰撞组。CircleBody2D 的 Collision Group=2、Collision Mask=2，仅阻挡其它宠物；英雄、骷髅和 Boss 保持默认组/掩码 1，因此双方能够穿过。原红龙/狐狸半径 50、白虎/蓝龙半径 100，按学习工程半比例设置为 25/25/50/50。
- 远离才跟随、靠近待机，接触其它宠物后停止或侧移，不指定固定队形；地图范围继续限制位置。Visual 围绕根节点翻转并按脚底深度排序。圆形身体不会挤到同一点，翅膀、尾巴和光圈仍可前后遮挡；攻击由 PetAttack 单独负责。
- 宠物贴图包含普通 Alpha，完全透明像素仍保留 RGB，例如 (71,112,76,0)。因此宠物与卡牌的 Spine 使用 Premultiplied Alpha = false；误开预乘会画出这些颜色，产生背景色块及过亮边缘。场景/Prefab 与运行时都已修正，原 PNG 未改动。
- 全局暂停时，只在绘制前手动推进卡牌预览的 Spine，英雄、敌人、已招募宠物和生成计时保持暂停。点击一次只招募一只，摇杆清空并在恢复后等待新的按下。

已完成二选一卡牌、招募、跟随、宠物攻击和英雄形态升级；神灯满额吐烟演出尚未实现。

## 宠物攻击

四只共用 PetAttack，招募后自动攻击，不增加操作按钮，保留自然跟随。第一轮检测到敌人即可攻击，后续两轮之间间隔 3 秒；每轮对 350×350 矩形范围内最多 100 只存活敌人各造成 10 点伤害，攻击框中心向上偏移 50。尺寸为原示例的 0.5 倍，检测敌人固定受伤矩形是否相交，并按距离从近到远处理。检查 EnemyController 和 BossController，英雄和其他宠物不会受伤。

命中时直接扣血，然后在每只骷髅的位置分别播放自己种类的技能特效。特效不会持续扣血；骷髅仍走原来的死亡动画/掉币流程。原宠物 Spine 没有 Attack 动作，因此待机/走路照常播放，没有新造一个攻击动作或 0.6 秒前摇。全局暂停同时冻结攻击冷却和特效序列帧，英雄死亡后宠物停止攻击。

四套原图集、索引、音效已直接导入 `assets/resources/gameplay/pet-skills`。PetHitEffect 根据 frames.json 建立图集区域的 SpriteFrame，播放原序列；同一种特效共享帧对象，并复用已经播放完的节点，不重新裁切/编码图片。普通 Alpha 的 PNG 在普通 Sprite 混合下保持透明。红龙 18 帧/0.9 秒，狐狸 22 帧/1.1 秒，白虎 17 帧/0.85 秒，蓝龙 25 帧/约 0.833 秒。按当前要求 Play Sound 已关闭，保留素材引用供以后启用；Boss 战也没有新增音效。

编辑器操作：

1. 本次检查发现当前 `localhost:7457` 预览服务仍缓存旧组件和旧 Prefab；先关闭并重新打开 Cocos 工程，等待资源导入与脚本编译，再打开 `Main.scene` 点顶部 ▶。如果正在编辑动画或 Prefab，先 Save、Close 回到场景。
2. 正常收集金币并完成一次神灯二选一，带宠物靠近骷髅，观察自动群体攻击。
3. 调整攻击：Assets/prefabs 双击对应 Pet Prefab，选根节点的 **PetAttack**；Damage=伤害、Attack Interval=间隔、Attack Width/Height=范围、Attack Offset Y=上下偏移、Max Targets=单轮上限。
4. 调整特效：打开对应 `Pet…Hit.prefab`；根节点 **PetHitEffect** 管图集、帧间隔和音效，子节点 **Skill** 的位置和锚点管落点显示。四种的 Hit Effect Prefab 已自动关联，不需要再拖入。

Main 继续使用现有四个宠物 Prefab 的 UUID，场景没有新建或改名。技能特效不挂 CircleBody2D，在角色上方绘制，播放结束隐藏；宠物移除时清理自己创建的特效。

## Boss 战（2026-10-04）

原 HTML 的 BossController 在 Process=Running 时累计 attackDelay=60 秒，因此**累计运行 60 秒出现一次 Boss**，与神灯阶段无关，选卡暂停不计时。原配置 life=250、attack=10、attackSpped=1；正常骷髅继续刷新。完整源配置和代码见 `../docs/试玩广告示例研究/Boss策略核对.json`。

已在现有 Main 的 World 上挂 BossBattleSystem，引用 Boss.prefab、出场提示和胜负界面；不需要重新拖素材。Boss 实例运行时才加入 World，编辑器默认不会显示黑龙。它使用原图集中的 27 帧待机、11 帧移动、16 帧攻击、4 帧死亡，BossVisual 直接读取图集索引，不生成额外裁剪图片；ANIboss Spine 仅是出场横幅。

- Boss 约在英雄一屏高距离处出现，遇地图边缘改用地图内的空位；追击、左右转身、身体阻挡、血条和深度排序已接入。
- 250 血，每轮攻击 5 点伤害，间隔 1 秒；挥击时停止移动，约 0.3 秒处命中一次。按用户要求由 10 减为 5，攻击框从 900×225 减为 450×112.5，锁定命中的检测框从 1125×1125 减为 562.5×562.5。原 isLock=true 的规则保留，完全退出缩小后的检测范围可躲开。
- 英雄挥剑和四种宠物技能都能伤害 Boss。Boss 的人物中心轴统一到根节点 X=0，各动作图片在 Visual 下校准偏移；伤害范围同步换算。血条直接放在 Boss 根节点下，固定 (0,300)，不再读取图片尺寸或跟随动作漂移；可在 BossController 的 Health Bar Offset Y 调高度。采用英雄同款 96×10 深绿色底、92×6 绿色填充，无圆角和数字，正向从屏幕右侧掉血。
- Boss 血量归零后解除阻挡，死亡动画结束显示胜利；英雄归零显示失败，冻结世界并清空摇杆输入。现阶段英雄尚无死亡动画，因此直接结算。
- 结算显示原 Logo、胜负文字、遮罩、黄色 DOWNLOAD 和手势，不显示“再玩一次”；游戏保持暂停。Logo 与胜负文字用 1 秒渐显。
- 当前宠物技能的 Play Sound 均为 false，Boss 不播放音效。

**快速查看：**选 Hierarchy/Canvas/World，在 Inspector 的 BossBattleSystem 中将 **Spawn After** 从 60 临时改成 5，保存后退出动画/Prefab 编辑模式，再打开 Main 预览。测试完恢复 60。调整 Boss 数值：双击 Assets/prefabs/Boss，选根节点的 BossController；Max Health、Move Speed、Attack Damage、Attack Interval 分别是血量、速度、伤害和间隔。默认移动速度 180，为当前骷髅 100 的约 1.8 倍。

TypeScript 检查和原生 Cocos 隔离验证通过：出场门槛/暂停排除、只生成一次、动画帧数、追击/转身、攻击范围/单次命中/冷却、英雄和宠物伤害 Boss、英雄同款血条在四种动作/不同帧/双向始终固定于人物轴、死亡/胜利、英雄死亡/失败、结算禁用摇杆且没有重玩按钮。金币吸附半径仍为 300，收集到脚边的半径为 20。三轮选卡、金币、浮动摇杆、宠物仅彼此碰撞、英雄/敌人穿过宠物且自身碰撞保留、地图边界回归通过。记录见 `../docs/试玩广告示例研究/学习工程验证/Boss战验证.json`；截图采用手动摆位与加速计时，未验证实体手机、广告容器或自然完整通关。


## 浮动摇杆操作

JoystickController 的 Input Area 留空时自动使用父节点 Canvas。无需增加全屏图片，也不用手动拖动新的关联字段。

## 英雄形态进化（2026-10-04）

原示例 UI_Shop 每次确认宠物后调用 PlayerController.upgrade；形态按招募次数推进，与宠物种类无关。前三种形态使用各自的序列帧，最终第四形态切换到 Spine。EntityData.onEnable 将当前血量重置为最大血量，所以进化同时回满血。原配置和代码记录在 `../docs/试玩广告示例研究/英雄进化核对.json`。

| 形态 | 触发条件 | 最大血量 / 进化后血量 | 英雄每剑伤害 | 动画 |
| --- | --- | --- | --- | --- |
| 1 | 开始游戏 | 100 | 1 | 原 HeroIdle/Walk/Attack |
| 2 | 选第一个宠物 | 200 | 1 | 第二套待机、走路、攻击序列帧 |
| 3 | 选第二个宠物 | 300 | 1 | 第三套序列帧，原比例变大 |
| 4 | 选第三个宠物 | 500 | 10 | 原 MX_j_m_zhanshi_L4_2 的 Idle/Move/Attack 骨骼动画 |

Hero 根节点的身体坐标和正缩放保持不变，只在 Visual 下按原示例的动作偏移与比例显示。HealthBar、Shadow、GroundRing 都是 Hero 的直接子节点，不随左右转身翻转。血条横坐标固定为 0；每个形态只更换固定高度。阴影为椭圆，黄色圈直接引用宠物使用的 partner-light.png；它们围绕英雄身体轴而非整张贴图中心。

HeroEvolution 监听招募成功事件，将各级原图集区域和帧顺序生成原生 AnimationClip，切换 HeroController 的动作、伤害、攻击范围和命中时机；第四形态由 HeroVisual 播放 Spine，待机/走路在轨道 0，攻击在轨道 1。还播放原升级光效，各形态使用对应的原挥砍特效和前摇空帧。进化会清理上次挥剑状态，避免旧形态残留判定。攻击宽高依次为 100×100、125×125、150×150、175×150；身体碰撞半径与移动速度沿用此前设置。

新素材、Spine 和形态配置已导入 `assets/resources/gameplay/hero`，HeroEvolution 的全部引用已经保存到 Main。查看组件：Hierarchy → Canvas → World → Hero；查看配置：Assets → resources → gameplay → hero → forms.json。编辑器中的初始画面仍是第一形态，后续形态在选卡时切换。无需再次拖资源，打开磁盘上的 Main 后预览即可。

验证：TypeScript 检查、Main 资源引用完整性检查通过。原生 Cocos 隔离运行磁盘场景，使用真实鼠标完成三次神灯选卡，检查每级回血/伤害/原动作帧/Spine、位置与转身轴不变、最终一剑只命中一次及 10 点伤害、黄色圈和阴影；Boss 5 点伤害及缩小后的起攻/锁定范围通过。三轮鼠标/触屏招募、进化后摇杆移动和宠物跟随、独立碰撞组、Boss 出场/攻击/血条/胜负回归通过，浏览器错误为空。详见 `../docs/试玩广告示例研究/学习工程验证/英雄进化验证.json`；对应形态截图已查看。测试使用快速投币和手动摆位，未验证手机、广告容器或自然完整通关。

- 运行时默认隐藏。手指或鼠标按下后，把 Joystick 移到该点，并显示底盘与圆钮。
- 本次操作的底盘中心固定在按下点，拖动只改变圆钮位置和移动方向；圆钮移动半径仍由 Max Distance 控制。
- 松开、取消触摸、窗口失焦、游戏进入后台或组件禁用时，隐藏摇杆并停止英雄移动。
- 多指操作只认最先按下的手指，其他手指不会改变中心、方向或结束当前操作。
- 神灯满额的遮罩会禁用摇杆组件并清空输入；恢复后需重新按下。暂停时的新按下不会唤出摇杆。
- Joystick 继续位于 Canvas 下，避免随 World 滚动；UIOpacity 控制外观隐藏，节点保持激活以继续接收下一次输入。编辑器里仍可看到摇杆外观并调整图片。

验证使用原生 Cocos 场景及当前脚本，在浏览器中实际发送鼠标事件与模拟触屏事件，覆盖多个按下位置、按下点坐标、固定底盘、圆钮限位、人物移动、视口外松开、失焦、多指、触摸取消，以及神灯遮罩和恢复。尚未在实体手机上验证。模拟不可取消的 touchcancel 时，原生引擎的 preventDefault 会产生浏览器诊断，取消后隐藏和停止移动的断言通过。

## 保留的规则和参数

- 英雄移动速度 300，攻击间隔 0.5 秒。
- 骷髅生成间隔 0.2 秒，同时存活上限 200；Enemy.prefab 原有参数未改写。
- 英雄和骷髅碰撞、身体轴翻转、地图边界及前后遮挡逻辑保留。
- 第一盏神灯预置 1/10；投币扣余额，满额停止扣款并暂停游戏。
- 神灯满额后显示伙伴二选一并暂停；选择后立即招募、恢复游戏并推进下一阶段。吐烟演出留待后续。
- EnemySpawner 节点保留，方便单独查看刷怪参数。World 继续挂金币与神灯系统，无需给每个管理组件单独创建节点。

脚本保留了对旧 Main.scene 的兼容：缺少预建视图或 Prefab 时，仍可使用原来的创建方式。新场景使用已保存的节点和 Prefab，不会再重复生成固定视图。

## 本次验证

- TypeScript 检查通过。
- 使用原生 Cocos 对磁盘上的新场景及 Prefab 反序列化，并运行当前脚本验证：关联正确、没有重复视图、参数保留、血条和翻转、移动、金币掉落与吸附、挥砍播放、骷髅死亡单次掉币、神灯扣币与进度、满额遮罩与暂停、恢复及阶段切换。
- 隔离验证未报告浏览器错误。神灯 Spine 数据从本地文件加载，避免把当前编辑器缓存是否已刷新混入逻辑结论。
- 记录图片：`../docs/试玩广告示例研究/学习工程验证/场景与Prefab整理-隔离测试.png`。测试中手动摆放神灯并关闭生成器；它不是原示例自然操作截图。
- 尚需在你打开新场景后的正常编辑器预览里确认资源导入与显示。未验证手机和广告容器。

宠物验证：TypeScript 检查通过；Main.scene 和全部四种 Pet Prefab 在原生 Cocos 中反序列化，真实浏览器鼠标和模拟触屏选择通过。覆盖三次投币门槛 10/50/100、两个首选分支、重复招募拒绝、点击遮罩不选、选卡暂停/恢复、卡内动画、原宠物资源加载、摇杆恢复、跟随/待机/翻转、地图限制及脚底排序，浏览器错误列表为空。截图和详细记录见 `../docs/试玩广告示例研究/学习工程验证/宠物系统验证.json` 与该目录中的“宠物”截图。隔离测试关闭生成器并用掉币/吸附快速准备钱包，部分截图手动摆位；未表示自然通关或实体手机验证。

透明背景修正保留：四种宠物和卡牌都关闭 PMA，原 PNG 不变。此前固定随行位置方案已按用户要求撤回；`宠物-透明背景与三只随行-隔离测试.png` 是旧方案的历史截图。

自然跟随验证：附近小幅移动不带动宠物，远离后追上；出生和跟随在地图中心及四角均限制在地图内并保持宠物身体间距。四种宠物只阻挡彼此，整段路径碰撞避免高速穿过另一只宠物；英雄/骷髅能够穿过宠物，英雄/敌人的身体阻挡保留。三轮选卡、暂停/恢复、透明设置、朝向和深度排序通过，错误为空。记录见 `宠物系统验证.json`；当前截图为 `宠物-仅彼此碰撞-隔离测试.png`。旧无阻挡和全部身体阻挡截图均为历史方案；未验证实体手机。

宠物攻击验证：TypeScript 检查通过；原生引擎加载四个宠物及特效 Prefab、原 PNG/帧索引/音效，检查群体命中、范围排除、每敌人独立特效、100 目标近远顺序、冷却、序列帧不重复伤害、暂停/恢复、生命周期与节点复用、死亡/身体退出及英雄死亡停止攻击。实际 Cocos 帧调度连续运行 3.2 秒完成两轮攻击，四套表现截图均已查看；完整招募/摇杆/跟随/碰撞回归也通过，错误为空。详见 `../docs/试玩广告示例研究/学习工程验证/宠物攻击验证.json`。测试手动摆放高血量骷髅便于检查重复攻击，未代表自然通关或实体手机验证。

运行游戏只需 Cocos 打开 Main.scene。

## Logo 与下载入口（2026-10-04）

对原 HTML 的开场、运行、选卡、胜利和失败状态逐一核对：游戏内左上 Logo 和右下 DOWNLOAD 从开场可见，选卡暂停不会关闭它们；结算关闭 game UI，改为居中的 Logo、胜负文字与下载按钮。原 SDK_DownLoad 最终调用 $soyooFacadeImpl.onGameInstall，属于平台安装入口。证据为 `../docs/试玩广告示例研究/Logo与下载按钮核对.json`。

Main 新增 AdHUD，直接引用原 logo-en 和 button-download，并导入原 text-download-en、tutorial-hand；结算沿用原大 Logo/胜负文字，新增黄色按钮与动态手势。常驻 UI 在选卡遮罩上方，结果出现时隐藏；Logo/文案 1 秒渐显。Canvas 上的 AdPresentation 使用绘制事件推进 UI，所以人物暂停时手势、渐显和下载点击仍可工作。所有引用已关联，下载按钮通过 BlockInputEvents 防止摇杆误触；地图空白处仍可拖动移动。

两个按钮共用下载逻辑：有平台 `$soyooFacadeImpl.onGameInstall` 时调用它；没有平台接口时可填写 Canvas/AdPresentation 的 Download Url；两者都没有时发出浏览器 `playable-download-request` 与 Canvas 的 `download-request` 事件，包含 source=hud/result。本地默认没有真实下载地址，不会假装下载成功，也不会重玩。真实投放时由宿主接口或配置地址完成跳转。

TypeScript 和原生 Cocos 隔离验证通过：常驻锚点、真实鼠标点击、平台回调只触发一次、本地请求事件、下载按钮不触发摇杆、背景拖动正常、选卡暂停入口保留、胜负内容切换、结算隐藏角落 UI、暂停期间渐显与手势、结算点击不重玩、尺寸适配；错误为空。Boss 战及三轮鼠标/触屏选卡与宠物跟随回归通过。记录 `../docs/试玩广告示例研究/学习工程验证/广告UI验证.json`，常驻/选卡/胜负截图已查看。平台安装使用模拟宿主验证，未实际下载或验证投放平台/手机。

## 血条、召唤进度与金币栏（2026-10-05）

已使用 textures/undersea/ui/hud 下 8 张拆分 PNG 替换主角和 Boss 血条、扇贝上方召唤进度、右上角金币栏。底框与图标固定；绿色和青色填充使用 Sprite 水平 Filled 从左到右裁切，保持填充画布尺寸，受伤和投币时仅改变 fillRange。血量/上限、召唤已付/门槛与金币余额均由 Label 实时显示，原进化回血、投币、收集与消费逻辑保留。金币栏独立图标不再被地图掉落金币覆盖。原始 PNG 内容保留，未接入含示例数字的 previews 图片，按用户要求未运行效果检查。

## 金币 HUD 更新（2026-10-05）

已同步最新 currency-frame.png 与 currency-icon.png。栏宽由 210 调为 150，图标宽度 44，数字在栏内水平和垂直居中显示。可用金币余额上限为 999，满额后继续拾取不会增加余额；消费后仍可拾取补回。累计收集统计保留原逻辑。按用户要求，本次未运行效果检查。

## 随机召唤台位置（2026-10-05）

三轮召唤台改为每局随机生成，当前轮位置生成后保持不变。按召唤台、阴影、进度条和图标的整体包围盒确定安全区域，外侧额外保留 120 单位地图留白；优先与英雄和前几轮召唤台保持 500 单位间距，区域不足时优先保留边缘空间。线路指引继续指向当前召唤台，招募、投币和进化逻辑保留。按用户要求未运行效果检查。

## 结算标题移除（2026-10-05）

已删除 Main.scene 的 Win、Lose 标题节点及组件，清除 BossBattleSystem 的胜负标题引用和 AdPresentation 的对应渐显引用。保留结算 Logo、下载按钮和手势，图片源文件继续保留。未运行效果检查。

结算下载按钮已上移，Logo 与按钮之间保留 28 单位间距，两者整体在屏幕中央，下载手势跟随按钮上移。Boss 预警横幅等比缩小，宽度由 760 调整为 520。按用户要求未运行效果检查。

## 背景音乐（2026-10-05）

已导入 assets/audio/music/bgm-undersea-game-loop.mp3，并在 Main.scene 的 Canvas 下添加 BackgroundMusic 节点及 AudioSource，启用自动播放、循环播放，默认音量 0.3。选卡暂停和结算时音乐继续播放；可在该节点的 AudioSource 中调整音量。浏览器如限制自动播放，首次点击或拖动游戏画面后播放。原始音频未修改，按用户要求未运行播放效果检查。

## 示例音效（2026-10-05）

已导入示例 audio/sfx 中全部 16 个 MP3 至 assets/audio/sfx，并在 Main.scene/Canvas/SoundEffects 保存 AudioSource、音效组件及完整资源引用。接入英雄两种攻击音效、小兵死亡、Boss 预警与攻击、拾币与投币、选卡打开与确认、英雄进化、四种宠物技能和胜负结算，保留当前海底背景音乐。

沿用示例音量：小兵死亡 0.5，Boss 攻击和选卡确认 0.6，英雄第三及最终形态攻击 0.8，其余 1。英雄第一形态起攻立即播放，其余形态起攻后 0.2 秒播放；拾币、小兵死亡、Boss 攻击间隔至少 0.5 秒，投币至少 0.1 秒，四种宠物技能各自至少 1 秒。死亡和结算只在对应状态首次发生时触发，选卡及结算暂停期间提示音仍可播放。四种 PetHit Prefab 已启用音效并改为引用统一导入的音频。主题目录副本整理在 audio/sfx/reference，索引同步更新。按用户要求未运行测试或播放效果检查。

## 第一形态英雄动作（2026-10-05）

碰撞与血条适配：第一至第四形态身体阻挡半径为 34/36/40/46，受击矩形和地图边界留白随各形态同步调整。血条中心高度改为 104/110/124/140，在当前素材头顶保留至少约 14 单位间距，初始化和进化均使用同一配置。螃蟹身体半径为 44，受击范围 124×84，并同步调整停靠距离和近身攻击范围；章鱼 Boss 无身体阻挡，保留 330×300 受击范围。鲨鱼、海龟、海马、水母的身体半径分别为 36/38/30/40，宠物地图边界按新贴图显示画布更新。英雄、小兵与宠物的碰撞分组保留，身体范围固定，不随单帧动作或转身抖动。按用户要求未运行效果检查。

Boss 无阻挡修正：Boss.prefab 已移除 CircleBody2D，控制器不再要求自动添加身体组件。Boss 移动直接更新位置，出生不依赖身体碰撞检查，地图限制按素材画布留边；旧缓存 Prefab 上的身体组件在初始化时禁用并移除。英雄、小兵可以穿过 Boss，攻击与受击判定保留。未运行效果检查。

预览兼容修正：编辑器已打开的场景可能将新增的第一形态动画引用保留为空。HeroEvolution 初始化时会从已有 Visual/Sprite/Animation 的 HeroIdle、HeroWalk、HeroAttack 资源以及 HeroController 的动作引用补齐，避免静态兼容逻辑覆盖新动画。引用尚未刷新时也按 362 像素动作帧画布换算显示缩放。未运行播放效果检查。

已导入新生成的待机、奔跑、攻击各 12 张独立帧，共 36 张，保存在 assets/textures/characters/sea-hero/animations/stage-01。assets/animations/HeroIdle.anim、HeroWalk.anim、HeroAttack.anim 的 spriteFrame 轨道已替换为对应 12 张新帧，保留资源 UUID。待机 10 FPS、奔跑 12 FPS 循环，攻击 15 FPS 播放一次后恢复移动状态。Main.scene 中 Visual/Sprite 的 Animation、HeroController 和 HeroEvolution 都引用这些磁盘动画文件，第一形态不再运行时重新生成动画。小画布按原静态图比例换算显示缩放，保持身体轴、转身方式、血条和既有命中逻辑。场景初始显示待机首帧，后续形态继续使用现有主题外观。总图与 HTML 预览不导入运行时工程。按用户要求未运行测试或效果检查。

## 四形态 24 帧英雄动画（2026-10-05）

四个形态的待机、奔跑、攻击各 24 张新帧全部接入，总计 288 张。素材保存在 assets/textures/characters/sea-hero/animations/stage-01 至 stage-04，原第一形态帧 UUID 保留、文件内容与尺寸同步更新。第一形态仍使用 assets/animations/HeroIdle.anim、HeroWalk.anim、HeroAttack.anim；其他形态使用 assets/resources/gameplay/hero/theme-animations/HeroStage02/03/04Idle、Walk、Attack.anim，共 12 个可编辑动画文件。每套按预览设为 24 FPS，待机与奔跑循环，攻击单次播放。

Main.scene 的 Animation 和 HeroEvolution 已保存四形态动作引用。初始化与每次进化直接使用对应磁盘动画，不再使用静态替身；编辑器缓存缺少新数组时，从 resources 补齐后续形态，加载过程中收到招募事件会等待动画就绪后按顺序进化。四套素材画布分别为 256、512、336、320 像素，按实际非透明轮廓统一换算显示尺寸与脚底位置，透明边距不会把角色缩小。进化血量、伤害、音效、碰撞参数和头顶血条间距保留，Boss 双向不阻挡规则保留。源总图和预览 HTML 不导入运行时。按用户要求未运行测试或效果检查。

## 英雄动画降速（2026-10-05）

四个形态的 12 套 Cocos 动画已降速：待机 10 FPS，一轮 2.4 秒；奔跑与攻击 16 FPS，一轮 1.5 秒。保留每套 24 张帧图，调整动画时间轴和时长。第一形态命中按动画进度初始化，后续形态按既有命中进度随时长换算；挥砍特效按完整攻击时长伸缩，后续形态攻击音效延迟调为 0.3 秒。移动速度保留。按用户要求未运行效果检查。
