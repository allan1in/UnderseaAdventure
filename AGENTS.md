# 项目协作说明

- 不到万不得已，不要使用 computer use。
- 仅修改 UnderseaAdventure；保留原 mushroom 项目。
- 保留素材 .meta UUID，避免资源引用失效。
- 用户要求：后续默认不打包，先通过 Cocos 预览检查；仅在用户明确要求时构建打包。
- 以下内容从原 README 完整迁入，包含历史实现与验证记录。历史状态可能已过时，以当前代码、场景及用户最新要求为准。

---

## 当前压缩与线上加载（2026-10-07）

2026-10-10 水母骨骼预览：内置 imagegen 参考原 jellyfish/idle/idle-01.png 生成伞盖带脸/五条触手透明部件图，generation-prompts.json 保存提示词，主题 partners/animations/jellyfish/skeleton-rig 中 pet-jellyfish JSON/atlas/png。6 slots/12 bones，五触手各两骨骼连续加权网格（每条 6×18 网格），根部由完整伞缘遮挡。Idle 3s、Move 1.4s、Attack .72s 收拢蓄力/.36s 释放/恢复，60Hz 平滑采样；18 帧、拆分图和动态 previews/pet-jellyfish-skeleton.html 支持暂停/翻转。check-jellyfish-rig-preview.cjs 循环/恢复、Chrome 动态加载和已打包 Cocos 原生解析三动作通过 errors=[]，native.png 已查看。旧8941服务不可达，当前预览服务8942。未接入游戏、未打包或发布，待用户确认。

2026-10-10 乌龟骨骼接入 Cocos：import-turtle-rig.py 导入 assets/resources/gameplay/pets/turtle-rig 三文件并保持 meta UUID；SkeletonData 3e5aeccc-b13b-4cf3-9440-6c05c844483f 直接关联 PetFox.prefab.PetFollower.petSkeleton，旧 CharacterAnimation/Animation 停用清除 clips。PetFollower 创建 Visual/Spine，位置 (-6,-8)、scale .8，Idle/Move .08 混合，攻击 .68s 单次后恢复，不每帧重启动作。PetAttack 使用骨骼 Attack 保留原范围/冷却/即时伤害与特效逻辑。PetSelection 优先使用 petSkeleton，独立 Pet/Rig 子节点避免同节点 Sprite/Spine 渲染冲突，在卡片循环 Idle 并借用原有暂停 UI tick，145 可见边长；切换其他宠物时禁用骨骼恢复 Sprite。check-turtle-rig-source.cjs 注入当前三源码及新资源到现有原生游戏运行时：旧图片隐藏、Idle/Move 不重启、Attack 单次 10 伤害与一次特效、结束恢复、暂停选卡 Idle trackTime 推进、切回 Sprite 正常通过；errors=[]，temp/verification/turtle-rig/card.png 已查看。TS 通过。测试攻击目标/特效为可计数替身，保留生产逻辑，未验证真实敌人和实体手机；未打包或部署。

2026-10-10 乌龟连续头颈网格预览：用户批准消除头部拼接切线。内置 imagegen 参考原图生成 source-continuous-torso.png，头/短颈/胸腹/龟壳为一张连续贴图，generation-prompts-continuous.json 保存提示词。32×24 网格/1536 三角形，head 与 body 权重通过两轴 smoothstep 过渡；头部不再使用独立 region，四鳍独立，5 slots/7 bones。构建/Canvas 渲染器支持加权 mesh，使用逐像素采样避免三角边缘接缝。18 帧与动态预览更新 continuous3；现有 check-turtle-rig-preview.cjs 循环/恢复、动态加载、原生 Spine 三动作验证 errors=[]，native.png 已查看。仅预览，未接入游戏或打包。

2026-10-10 乌龟接缝修正预览：参考原图，通过内置 imagegen 编辑 source-parts-sheet-v2.png（generation-prompts-v2.json 保存提示词），去除身体圆形接口、减弱鳍脚圆形连接根部，重绘远侧前鳍的内侧奶白腹面；头部下移 8、左移 3，近前鳍根部从 y=-14 改为 2 并由头颈遮挡；远前鳍 x=45/y=-5、基础旋转 15°，朝右下伸展，远鳍根部仍在身体之后。18 帧和动态页面更新，图片 cache 版本 seams2、骨骼 JSON no-store。循环恢复、动态与原生 Spine 三动作测试通过 errors=[]。仅预览，未接入运行时或打包。

2026-10-10 乌龟骨骼预览：内置 imagegen 参考原 turtle/idle/idle-01.png 生成六部件图（首次连接失败后独立重试成功），主题 textures/characters/partners/animations/turtle/skeleton-rig 保存 source-parts-sheet.png、generation-prompts.json、六个透明切片、pet-turtle Spine 3.8 JSON/atlas/1024 贴图。7 bones/6 slots；Idle 3s 轻摆，Move 1.2s 四鳍交替，Attack .68s 抬头蓄力/.36s 远程释放/恢复，60Hz 平滑采样，远程玩法不改。tools/build-turtle-rig-preview.py 与 preview-turtle-rig.cjs 输出 18 帧 keyframes-sheet.png、parts-sheet.png 和 previews/pet-turtle-skeleton.html（暂停/翻转）。check-turtle-rig-preview.cjs 首尾恢复/循环衔接、浏览器动态加载和现有新单 HTML 内原生 Spine 三动画解析/绘制通过 errors=[]，browser.png/native.png 已查看；verification.json 在 previews/pet-turtle-skeleton-v1。当前仅预览，未接入 Cocos 运行时、未重新打包或发布，待确认外观。

2026-10-10 清理与重新打包：clean-unused-assets.py 按场景/Prefab/脚本/当前 resources 根和 UUID 依赖闭包清理 705 个未使用素材，61,729,685 字节（58.87 MiB），同步移除对应 .meta 和空目录；主题源素材目录保留。Boss.prefab 清空旧 dragon 动作纹理/索引，加载模板移除旧 theme-animations 预加载，保留四级骨骼、宠物逐帧与现用特效。清理后序列化 UUID 无缺失，TS 检查通过。当前 Boss 血条高度源码与 Prefab 均为 210。Cocos 3.8.8 构建成功，压缩单文件 build/undersea-adventure-single.html 为 19,519,147 字节（18.61 MiB），上一版本 25,466,465 字节，减少 23.35%；完整资源 gzip 10,967,301 字节（10.46 MiB）。check-single-html.cjs 更新骨骼就绪验收并检查真实离线新包：无外部请求/无错误、输入前不计时不生敌、移动/音乐、招募三宠物/进化四级、Boss 血量与伤害、音乐切换/胜利均通过。报告 build/verification/standalone-report.json；未发布线上或推送。

2026-10-10 Boss 确认后接入 Cocos：tools/import-boss-rig.py 导入 assets/resources/gameplay/boss/original-rig，双纹理、Spine JSON/atlas，骨骼 UUID eafd3e55-4f54-4ae1-b984-6bec2543ff55；deferred/Boss.prefab.bossSkeleton 直接引用，原 Prefab UUID 保留，旧 CharacterAnimation/Animation 停用并清除 clips。BossVisual 创建 Visual/BossSpine，沿用原 Sprite 位置 (-9.0249,22.3105) 与比例 1.50416，隐藏旧图片；Idle/Move 循环不重启，Attack .75s、Cast .8s、Death 1s 单次，Idle/Move 混合 .08s。远程技能触发改为 Cast，近战命中 .3s/5 伤害，血量 200、速度 200、受击范围、远程预警/触手逻辑、无身体阻挡和血条高度保持。死亡 .12s 闭眼、head 下沉、透明度 1，完整结束后单次 defeated 事件并隐藏；受击染色作用 Spine，销毁不触碰已释放的子骨骼。check-boss-rig-source.cjs 将当前两份源码与导入资源载入已有 Cocos 原生运行时，验证初始化、移动无重启、单次近战伤害、攻击恢复、仅 Visual 翻转、血条不翻转、Cast、闭眼/头部下沉/死亡完成前不结算、结束事件一次、延迟销毁无异常通过；report.json/death.png 在 temp/verification/boss-rig，截图已查看。限定 assets/scripts 的 TypeScript 检查通过，新骨骼 UUID 已出现在 library 导入缓存。测试为当前源码注入已有原生运行时，不等同于用户当前编辑器预览或实体手机验证；未打包、部署或推送。

2026-10-10 Boss 死亡按螃蟹逻辑再次修正：取消侧翻，Death .12 秒切换闭眼，头部控制点逐步下沉 17、身体下沉 7，后触手放松下垂，末帧仅 2.5 度轻倾且透明度全程 1。内置 imagegen 编辑原脸部裁片，source-closed-eyes.png 与 generation-prompts-closed-eyes.json 保存；prepare-boss-closed-eyes.py 仅将两处闭眼区域打包回原 320×320 贴图，得到 boss-original-dead.png，王冠、护甲、嘴部和触手的其他像素保留。Spine 新增 head 控制点及 body-dead 附件，双图集页面；其他动作从 0 秒恢复 body-art，防止闭眼附件残留。预览 Canvas 改为逐像素网格采样，避免头部压缩时三角裁剪产生接缝。death-keyframes.png 与动态预览已更新。检查五动作 60Hz 无网格翻折，原生 Death attachment=body-dead、headY 从 14 到 -3、alpha=1，错误为空。当前仍仅预览，未导入游戏或打包。

2026-10-10 Boss 死亡预览重新设计：取消渐隐，改为受击短摆、触手失去支撑向下松弛、身体向右倾倒、落地小幅回摆，1 秒后保留倒地姿态。body 角度 0/7/-9/-38/-64/-60，透明度全程 1，其他四动作保留；原版贴图没有新增闭眼表情。更新 build-boss-original-motion.py 与动态预览/30 关键帧，单独输出 previews/boss-original-motion/death-keyframes.png。检查增加全程颜色 ffffffff、末帧 -60 度与原生死亡 alpha=1 断言。仍仅预览，未接入游戏、未打包。

2026-10-10 Boss 原版造型五动作预览：使用已确认原版 idle-01 共享贴图，连续加权网格与六个局部触手控制点保持可见遮挡；8 bones、1 mesh、3200 triangles，主题 skeleton-original-motion。build-boss-original-motion.py、preview-boss-original-motion.cjs 输出五动作六姿态共 30 关键帧 previews/boss-original-motion/keyframes-sheet.png，动态 boss-skeleton.html 更新并支持暂停/翻转。Idle 3 秒含小幅触手摆动，Move 1.2 秒，Attack .75 秒/朝右/.3 秒出击，Cast .8 秒后触手抬起，Death 1 秒收拢倾斜淡出，无闭眼换图。攻击伸展限制在不导致网格翻折的幅度；隐藏面未补画，不适合大范围改变前后遮挡。check-boss-original-motion.cjs 检查五动作每 1/60 秒网格有向面积为正（最小 27.51），Chrome 暂停采样与已有 Cocos 原生五动作/死亡淡出通过，errors 为空；verification.json、native-attack.png 保存，截图已查看。仅预览，未替换 Boss.prefab 或改变游戏攻击判定，未打包、部署或推送。

2026-10-10 Boss 原版待机还原：此前生成部件改变轮廓，全部触手置于头后也破坏原版前后交错关系。本次使用 idle-01 原图作为共享图集，通过 7 个可见区域网格重新组合，9 bones、84 triangles，保存主题 skeleton-original-idle；不重绘可见轮廓、不虚构被遮挡面。build-boss-original-idle.py、preview-boss-original-idle.cjs 生成原版/拼接对照 previews/boss-original-idle/original-vs-assembled.png，原尺寸 320×320 拼接逐像素差异为 0，comparison.json 保存。动态 boss-skeleton.html 现为原版待机对照，整体 3 秒 ±1 像素轻浮动，暂停恢复原姿态。check-boss-original-idle.cjs 验证浏览器同尺寸像素一致，以及既有 Cocos 原生运行时七个 mesh attachments、Idle 3 秒/浮动 1 像素可渲染，errors 为空；verification.json 与 native.png 保存，截图已查看。独立触手变形、隐藏面补画以及其他动作尚未重建，此版本不能当作完整 Boss 骨骼动画；未导入游戏或打包。

2026-10-09 Boss 外观预览修正：用户指出拆分后的造型偏离原版。以 idle-01 的紫色圆胖头部、偏右金冠紫钻和后侧灰岩轮廓重新生成普通/闭眼完整头部，source-heads-v2.png 与 generation-prompts-v2.json 保存。王冠包含在头部内，原 crown slot 暂不显示，避免分层改变位置。调整后侧、左侧触手比例与位置；主触手使用现有自然卷曲部件生成连续网格，取消把直伸贴图强行折叠的待机姿态，攻击中段向眼神方向舒展。更新五动作与 30 关键帧，compare-boss-identity.cjs 生成原版/修正版同高度对照 original-vs-skeleton-v2.png。头部和整体轮廓更接近原版，触手形状仍有差异，不是像素级复原。修正版 Chrome 与现有 Cocos 原生运行时五动作兼容检查通过，errors 为空；仍仅主题素材预览，未导入 Boss.prefab，未打包、部署或推送。

2026-10-09 章鱼 Boss 骨骼预览：参考当前 idle-01 与 attack-12，经内置 imagegen 生成头部、王冠、死亡头部和八条完整触手共 11 部件；主题 textures/characters/boss/animations/skeleton-rig 保留 source-parts-sheet.png、generation-prompts.json、独立 PNG 与 boss-octopus JSON/atlas/PNG。触手采用连续加权网格与 4/5 段骨骼，37 bones、10 slots、8 meshes；头部压短、王冠下移保持紧凑轮廓，主触手待机卷曲，攻击沿眼神朝右横扫。Idle 2.4s、Move 1.2s、Attack .75s（命中姿态 .3s）、Cast .8s、Death 1s，60Hz 单调三次曲线；死亡 .15s 切换同轮廓闭眼头。工具 build-boss-skeleton-preview.py、preview-boss-skeleton.cjs，30 关键帧 previews/boss-skeleton-keyframes-v1/keyframes-sheet.png，动态 previews/boss-skeleton.html。check-boss-skeleton-preview.cjs 验证所有顶点骨骼索引/权重和网格索引，Chrome 动态加载五动作无错误；既有 Cocos 原生运行时加载新图集验证五动作、连续网格渲染和死亡头替换通过，截图与报告 temp/verification/boss-skeleton-preview 已查看。仍是预览与兼容检查，尚未导入 Boss.prefab 或修改攻击判定、远程技能、血量、移速、非阻挡设定；未打包未部署。

2026-10-09 召唤台确认后接入 Cocos：tools/import-summoning-scallop-rig.py 导入 assets/resources/gameplay/summoning-scallop-rig，UUID ec30cca6-4ada-423d-91ae-99df397c66b5；Main.scene 的 MagicLamp 新增直接关联 Spine 节点与 lampData，停用旧静态 Sprite，原素材保留。底部原点、比例 .73，上下壳/珍珠/底座四 slots，金币目标高度 115.34 与珍珠一致；随机位置、底座椭圆 85/35、进度条原位保留。MagicLampSystem 配置短混合：idle 3s、idle2 .5s；满额先播放 summon 1.2s 再打开宠物选择暂停，防止动画被中途暂停；满额后不再扣币，pets-ready 不提前跳过动画，每轮重置动画状态。tools/check-summoning-scallop-source.cjs 将当前支付源码与新图集载入已有 Cocos 原生运行时，验证三轮正常扣款（首轮预置 1 枚）、投币反馈、升珠、完成前不弹窗、每轮两张卡、选择/恢复/第三轮隐藏、底座固定与珍珠目标通过，错误为空；截图 temp/verification/summoning-scallop-rig/summon.png 已检查，report.json 保存。assets/scripts TypeScript 检查通过。library 尚未出现新 UUID 导入缓存；原生注入验证不等于用户编辑器刷新或实体手机验证。未打包、未部署、未推送。

2026-10-09 召唤台骨骼预览：参考现有 summoning-scallop.png，经内置 imagegen 生成上壳、下壳、珍珠、珊瑚石台四个透明部件，原静态素材保留。新素材、Spine 3.8 图集/JSON 与 generation-prompts.json 位于主题 textures/props/summoning-scallop-rig。底部原点、上壳轴点在壳根，底座与下壳固定；idle 3s、idle2 投币反馈 .5s、summon 满额升珠 1.2s，60Hz 平滑曲线，5 bones/4 slots。工具 build-summoning-scallop-preview.py、preview-summoning-scallop.cjs；18 关键帧 previews/summoning-scallop-keyframes-v1/keyframes-sheet.png，动态 previews/summoning-scallop-skeleton.html。Chrome 动态加载检查四部件、三动作、固定底座、首尾恢复通过，错误为空，截图 temp/summoning-scallop-preview.png 已查看。当前仅预览，未修改 Cocos 召唤流程或运行时资源，待用户确认外观后接入；未打包、未部署。

2026-10-09 修复螃蟹移除时报 setListener 空引用：Cocos 先销毁子节点的 Spine，再调用父 EnemyController.onDestroy；原 setCompleteListener(null) 触碰已释放的骨骼运行时。移除该调用，监听器由 Spine 自行释放，控制器仅清空引用。check-crab-rig-source.cjs 增加 enemyNode.destroy 和恢复 director 后的延迟销毁检查，实际销毁成功、错误为空；原移动/攻击/死亡单次掉落回归通过，TypeScript 通过。未打包未发布。

2026-10-09 螃蟹确认后接入 Cocos：tools/import-crab-rig.py 导入 assets/resources/gameplay/enemies/crab-rig，Enemy.prefab.crabSkeleton 直接引用 UUID ffce6ffa-076b-4990-b302-e7815e334172，预制体原 UUID 保留，四种逐帧动画引用解除；EnemyController 在 onLoad 创建 CrabSpine，比例 .84，单轨道，待机/移动短混合，攻击 .55s、命中 .28s、死亡 .85s。攻击方向沿眼神，左右整体翻转；受击闪色同时作用骨骼，死亡立即解除阻挡，完整动作结束后仅掉落一次金币并移除。tools/check-crab-rig-source.cjs 将当前控制器与新图集装载至已有 Cocos 原生运行时，验证 Idle、移动不重启、单次命中、主螯方向、翻转、攻击恢复、死亡表情/退出碰撞/延迟单次掉落均通过，错误为空；报告 temp/verification/crab-rig/report.json，截图 attack.png 已查看。限定 assets/scripts 的 TypeScript 检查通过。当前 library 尚无新骨骼 UUID 缓存，需要编辑器完成资源刷新；原生注入验证不等于编辑器预览或实体手机验证。未打包、未部署、未推送。

2026-10-09 螃蟹攻击朝向再次修正：原左螯出击与素材眼神朝右相反，现改为画面右侧主螯出击、左螯收拢，身体倾斜同步反向；整体翻转后眼神与夹击仍同向。已更新骨骼轨迹、关键帧和动态预览，仍未接入 Cocos。

2026-10-09 螃蟹攻击预览方向修正：取消左右双螯镜像同时挥击，改为左侧主螯蓄力、前伸夹合、回收，另一螯仅小幅收拢，身体向出击侧轻倾；整体翻转后改变攻击方向。攻击仍 .55s、命中姿态 .28s、首尾回到待机；其他动作保留。关键帧与动态预览已重生成，Chrome 加载检查错误为空。仍为预览，未接入 Cocos。

2026-10-09 螃蟹骨骼预览：参考现有红色螃蟹拆分 16 个透明部件，包括身体、八条步足、左右臂、钳掌、活动钳指和死亡表情；双钳掌另行生成修正。素材与提示词保存在主题 crab/skeleton-rig，预览 Spine 3.8 为 16 bones/slots。Idle 1.5s、Move .8s、Attack .55s、Death .85s，每动作六个关键姿态，60Hz 平滑轨迹。工具 prepare-crab-rig-parts.py、build-crab-rig-preview.py、preview-crab-rig.cjs；动态 previews/enemy-crab-skeleton.html 与关键帧 enemy-crab-skeleton-v1/keyframes-sheet.png。Chrome 动态加载检查四动作、16 部件通过，错误为空，截图 temp/crab-skeleton-preview.png。当前仅预览，尚未修改 Cocos 螃蟹运行时，等待用户确认外观；未打包未发布。

2026-10-09 四形态持剑待机统一调整：tools/hero_sword_rest.py 对已确认 poses 的副本应用低位持剑，上臂放低 30°，以各形态武器局部安装角补偿手腕，使 Idle/Move 剑刃全局方向统一 5°；Attack 首尾接回新 Idle，攻击中间关键帧保留。四个导入脚本均应用同一规则，输出 poses-sword-rest.json，原确认 poses.json 保留。四形态骨骼重导入，UUID 保留；前三阶段肘/腿和第四披风修正不变。对比图 previews/hero-sword-rest/four-forms.png，动态预览已更新。check-hero-sword-rest.cjs 在已有 Cocos 原生运行时加载当前源码与四套 atlas，四形态招募进化/100 血/剑手挂点/待机和游泳六节点方向/攻击六节点/收招/攻击移动全部通过，错误为空；报告 temp/verification/hero-sword-rest/report.json。未打包、未部署，不等于编辑器完成缓存刷新。

2026-10-09 第四形态按确认 v3 接入 Cocos：stage04-rig 的 Spine JSON/atlas/PNG、Main.scene 的 HeroEvolution.stageFourSkeleton（UUID 3c638d94-dd7a-404d-938b-4fe87ecc1ecb）已关联；四形态逐帧数组引用全部解除，第三次招募切换最新肘部/腿比例的最终骨骼、独立披风。Idle 2.4s、Move 1.2s、Attack .48s、命中 .205s、比例 .86、单轨道；三套加载模板预加载 stage04-rig。build-hero-stage04-preview.py --import 支持重导入并保留 UUID。TS 通过；check-hero-stage04-source.cjs 在已有 Cocos 原生运行时载入最新源代码与图集，进化/回血/17 slots/披风运动/移动不重启动画/攻击位移/六个剑方向/收招/翻转/最终形态不越级通过，错误为空。记录 temp/verification/hero-stage04-rig/report.json；截图已检查。场景四个骨骼 UUID 和逐帧解除核对通过；这不等于用户编辑器完成资源刷新。未打包、未部署。

2026-10-09 第四形态躯干/腿比例修正：躯干由 55×61 收至 51×59，近远髋部横向间距从 11 增至 22 并略上提，近远大腿由 21/18 加宽为 27/24，同步加宽小腿与靴子，长度仍保持紧凑 Q 版。肘部 v2 修正保留。修正版 previews/hero-stage04-sword-keyframes-v3，动态预览更新为 v=legs3；原版本保留，仅预览未接入 Cocos。

2026-10-09 第四形态肘部预览修正：上臂的近远侧实际连接点重新校准，远侧肘点下移；小臂替换为已确认第二形态的封闭金色 capsule，并使用关节内部枢轴留出连接重叠，消除两段开放接口拼接感。文件 stage-04/skeleton-rig/near-forearm-v3.png 与 far-forearm-v3.png；修正版 previews/hero-stage04-sword-keyframes-v2，动态 hero-stage04-skeleton.html 已指向新版。仅预览，未接入 Cocos。

2026-10-09 第四形态骨骼预览：以现有最终形态外观/攻击帧为参考生成 16 部件与专属短剑，披风单独拆分并由 cape/body 骨骼驱动；沿用已确认的近远拳头，修正远侧小臂方向，保持头大短身。素材与提示词统一在主题 stage-04/skeleton-rig；18 关键帧 previews/hero-stage04-sword-keyframes-v1，动态 previews/hero-stage04-skeleton.html。18 bones、17 slots；Idle/Move/Attack 动态预览加载错误为空，肘腕角度约束与三动作首尾衔接检查通过。工具 prepare-hero-stage04-parts.py、preview-hero-stage04-keyframes.cjs、build-hero-stage04-preview.py。仅预览，等待外观确认后再接入 Cocos，未打包未发布。

2026-10-09 第三形态确认后接入 Cocos：stage03-rig 的 Spine JSON/atlas/PNG 与 Main.scene 的 HeroEvolution.stageThreeSkeleton UUID 7c209b3a-0fa3-44e6-82b6-2d649f92d6ca 已关联，解除第三形态逐帧数组引用；Idle 2.4s、Move 1.2s、Attack 0.48s、命中 .205s，比例 .80、单轨道。三套加载模板同步预加载并识别第三形态骨骼。TS 检查通过。check-hero-stage03-source.cjs 将当前源代码与新图集载入已有 Cocos 运行时，验证第二次招募进化、满血、16 slots、移动不重启动作、攻击允许位移、六个剑方向/挂点、恢复待机、翻转与第四形态恢复逐帧，错误为空；报告 temp/verification/hero-stage03-rig/report.json。实际 7456 编辑器预览等待超时，library 尚无新 UUID 的导入缓存，不能声称编辑器实测已通过；需要编辑器刷新资源并重开 Main.scene。未打包、未部署。

2026-10-09 第三形态骨骼预览：使用现有第三形态静态/攻击素材为参考生成身体拆分与专属短剑，复用已确认的近远拳头视角，校准水平肩肘连接并保持紧凑 Q 版比例。素材统一在主题目录 stage-03/skeleton-rig，提示词 generation-prompts.json。18 张待机/游泳/攻击关键帧位于 previews/hero-stage03-sword-keyframes-v1；动态预览 previews/hero-stage03-skeleton.html 使用部件与 Spine 骨骼轨迹实时绘制，17 bones、Idle/Move/Attack，浏览器加载错误为空。工具 prepare-hero-stage03-parts.py、preview-hero-stage03-keyframes.cjs、build-hero-stage03-preview.py。当前仅预览，尚未替换 Cocos 第三形态；未打包、未发布。

2026-10-09 补充修复：上一轮仅等待宠物异步加载，没有撤销运行时异步依赖，且 Cocos 内置启动脚本仍会提前设置 splash display:none。现已恢复 Main.scene 四只宠物 Prefab 直接引用，预览启动前也预加载后续资源；三套加载页用未完成状态的 CSS 优先级阻止内置脚本提前隐藏。旧编辑器内存场景的空引用仍由兼容加载补齐，加载页始终等待它完成。实际 7456 预览检查加载页提前隐藏次数为 0；按正常 spendCoins/update 投币完成 10/50/100 三轮，均显示两张卡并招募，错误为空。TS 通过（--lib ES2017,DOM）；未打包、未发布。验证脚本 tools/check-lamp-natural-preview.cjs。

2026-10-09 修复 Cocos 预览召唤台满额未弹窗：预览加载页现在与 web-mobile 一致，等待宠物/Boss/英雄资源就绪后进入游戏；PetSystem 在 onLoad 开始加载四只宠物，assetsReady 逐项验证引用；MagicLampSystem 满额后每帧尝试弹窗，不再依赖单次 pets-ready 事件，也不重复扣款。`tools/check-lamp-preview.cjs http://127.0.0.1:7456` 已在真实编辑器预览验证资源延迟恢复、2 张卡牌、暂停、招募、第二形态骨骼进化和恢复运行，错误为空；TS 通过。未打包、未发布。

2026-10-09 第二形态按确认的 `hero-stage02-sword-keyframes-v3/poses.json` 接入，近远拳头使用第一形态不同视角，小臂为修正版，贝壳肩甲/头饰和武器为第二形态专属。`tools/apply-hero-stage02-keyframes.py` 导入 `assets/resources/gameplay/hero/stage02-rig`，HeroEvolution.stageTwoSkeleton 场景引用和资源加载 fallback 已关联；停用第二形态逐帧引用。短剑局部旋转 -30°，与预览 handAngleOffset=60° 一致。`tools/check-hero-stage02-source.cjs` 在现有 Cocos 运行时载入当前源码与新 atlas，进化、满血、16 部件、3 动作、剑角度、攻击移动、翻转及第三形态恢复逐帧通过，TS 通过。未打包、未发布；不等于实体手机或用户编辑器预览验证。

2026-10-09 第一形态已按确认的 `hero-stage01-sword-keyframes-v3/poses.json` 接入待机、游泳、挥剑攻击，使用 15 身体部件及贝壳短剑，单 atlas，保留 UUID。`tools/apply-hero-stage01-keyframes.py` 生成平滑骨骼轨迹并导入；短剑骨骼跟随 near-hand，局部 rotation=0（图片本身朝上，不能额外旋转 90°）。最新方向修复未重新打包；`tools/check-hero-stage01-rig.cjs <URL> --source-rig` 在 Cocos 运行时载入最新源 JSON，六个攻击姿态角度、武器挂点、动画切换、攻击时移动及第二形态进化通过。

2026-10-08 第一形态骨骼动画：新素材位于主题目录 `textures/characters/hero/animations/stage-01/skeleton-rig`，含 15 个透明部件、1024×1024 atlas 贴图、Spine 3.8 JSON、atlas 和制作提示词；独立部件保留在主题目录，运行时仅导入 `assets/resources/gameplay/hero/stage01-rig/hero-stage-01.{json,atlas,png}`。`tools/build-hero-stage01-rig.py` 提取部件、生成骨骼/动画和稳定 UUID，并更新 Main.scene。第一形态 Idle 2.4 秒、Move 1.2 秒、Attack 0.48 秒，命中时刻 0.205 秒；HeroVisual 使用同一骨骼和短混合过渡。第一形态旧逐帧源码保留，场景与控制器解除其动画引用；后续形态维持现有逐帧，进化时正确切换。完整加载页预加载新骨骼资源。TS、Cocos 构建、实际 Spine 渲染、移动动画不重置、攻击时位移、左右翻转、攻击恢复、进化及满血、完整招募/Boss/音乐回归通过，错误为空；截图和报告在 `build/verification/hero-stage01-rig`。当前本地压缩 HTML 约 24.1 MiB，gzip 约 15.0 MiB。本轮骨骼版本尚未发布线上或推送 GitHub；未验证实体手机。可运行 `tools/check-hero-stage01-rig.cjs <URL>` 检查骨骼行为。

2026-10-08 更新：按用户要求，加载页下载全部 1815 项打包资源（gzip 约 15.5 MiB），不再使用开场/后续资源拆包。`tools/prepare-vercel.py` 生成完整 `startup.html.gz` 与旧浏览器 fallback `complete.html`；模板预加载宠物/Boss Prefab 和全部英雄动画，并等待场景组件接收资源才显示游戏。已删除 30 秒慢加载提示、重新加载按钮和重启逻辑，真实失败仅显示“资源加载失败”。本地手机视口限速模拟约 41.2 秒，整个检查仅请求首页和完整资源包；进入游戏后无追加下载。全部资源就绪、移动、招募、英雄进化、Boss 战和音乐回归通过；未验证实体手机。以下 2026-10-07 拆包方案和耗时是历史记录。

`tools/build-and-pack.ps1` 需要 Node.js、Python 与 Pillow。打包保留 `build/undersea-adventure-full.html` 原版，并输出压缩单文件 `build/undersea-adventure-single.html`；`tools/prepare-vercel.py` 仅压缩构建副本：静态背景和 UI 贴图按移动端显示尺寸缩小，并同步调整 SpriteFrame 的 rect、originalSize、offset 和 vertices；角色动画保留帧尺寸。原始 `assets/` 图片和音频不变。音频压缩使用项目临时目录中的 imageio-ffmpeg，可用 Python 安装到 `temp/media-python`。

线上发布目录为 `build/vercel-mobile`。根页面内嵌轻量加载界面，游戏资源放在内容哈希目录。`tools/pack-fast-start.cjs` 通过运行真实场景记录开场依赖，生成 `startup.html.gz`，后续资源合并至 `later-assets.json.gz`。现代浏览器下载并解压开场包，再通过 Blob iframe 启动；不支持 DecompressionStream 的浏览器使用普通分文件版本。按实际下载及 Cocos 预加载进度更新；加载缓慢或失败时显示重试按钮。不要再将巨大的单文件作为线上首个响应。`tools/check-mobile-deployment.cjs <URL>` 验证手机视口、限速网络、首次加载与触屏移动；第三个参数可指定加载上限毫秒数（如 `10000`）。模拟条件为下载 1.5 MB/s、70 ms 延迟及 CPU 4 倍限速；该模拟结果不等于实体手机验证。

2026-10-07 阶段状态：已重新构建用户最新 Boss 攻击素材，单文件约 24.7 MiB，开场包约 4.8 MiB；已发布至 https://undersea-adventure.vercel.app（部署 dpl_GkyYvbDfxxhhKhTmzGvipzmuihe9，资源 game-ff3078755719）。本地同体积开场包模拟约 15.3 秒；正式地址本轮限速模拟约 29.6 秒，加载界面和触屏移动通过、错误为空，10 秒目标仍未达成，未验证实体手机。后续英雄形态、宠物与 Boss Prefab 移至异步加载，Prefab `.meta` UUID 保留。子域名 undersea.allan1in.top 已关联项目，尚待 Cloudflare 添加 CNAME：undersea → b4f7530ac38b9d0e.vercel-dns-017.com，代理关闭（仅 DNS）。

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
## 水母原图连续网格预览（2026-10-10）

用户指出首版拆分素材未还原原始水母；改为直接复制原始 idle/idle-01.png 至主题目录 jellyfish/original-rig，贴图字节完全一致。使用一个连续加权网格、8 根骨骼，保留伞盖、五官和触手遮挡关系，通过局部小幅变形提供 Idle（3 秒）、Move（1.4 秒）、Attack（0.72 秒）。未接入游戏 Prefab、未重新打包。

生成脚本为 tools/build-jellyfish-original-motion.py、tools/preview-jellyfish-original-motion.cjs；预览页为主题目录 previews/pet-jellyfish-skeleton.html，18 张关键帧在 previews/pet-jellyfish-original-motion/keyframes-sheet.png。tools/check-jellyfish-original-motion.cjs 已验证权重归一、三角形无翻折、原始贴图一致，以及 Cocos 原生 Skeleton 三个动作正常播放、无运行错误。下一步接入需以用户批准的预览为准，并按水母尺寸单独适配游戏和卡片中的显示比例。



## 水母骨骼接入 Cocos（2026-10-10）

已按批准的原图连续网格版本导入 assets/resources/gameplay/pets/jellyfish-rig，SkeletonData UUID c64617b8-c197-4e32-957d-e4c4674029c7 直接关联 PetWhiteTiger.prefab 的 PetFollower.petSkeleton。保留原 Prefab UUID，停用旧 CharacterAnimation 和 Animation 并清空 clips。PetFollower 新增可序列化的骨骼显示及卡片尺寸参数，默认保留乌龟配置；水母沿用旧 Sprite 的 .5 比例和 (1.25,5.558935) 位置，卡片可见最长边 220、中心补偿 (2.5,13)，独立 Rig 节点循环 Idle，暂停期间继续推进。

check-jellyfish-rig-source.cjs 用当前源码和导入资源注入现有 Cocos 原生运行时，验证 Idle、Move 不重启、Attack 单次 10 伤害与一次特效、恢复 Move、暂停卡片 Idle 推进、切换其他宠物恢复 Sprite，错误为空。攻击目标及特效为计数替身，未验证实际敌人伤害和实体手机。TypeScript 检查通过，temp/verification/jellyfish-rig/card.png 已查看。未重新打包、部署或推送；当前源码资源接入不等同于旧 HTML 已更新。

2026-10-10 水母动作可见性修正：用户反馈不动。原 Idle 根骨上下幅度 1 像素、游戏 .5 比例后仅 .5 单位，视觉过弱；改为 Idle 根骨幅度 6、Move 9，身体摆动 1.2/2 度，触手局部横向 5/8、纵向 2.5/4，伞盖 3/5。保留原始贴图和 UUID，生成脚本重新导入当前 Cocos 资源。网格全动作无翻折（最小有向面积 19.327），原生动作与跟随/攻击/卡片回归通过。新增待机时间轴及 rootY 检查，.6 秒 rootY=5.7063，卡片暂停仍推进。直接编辑器首页场景查询未定位到 Canvas，不能视为用户当前窗口验证；采用当前源码注入原生运行时检查。未打包。

2026-10-10 海马原图连续网格预览：用户要求沿用水母思路。原 seahorse/idle/idle-01.png（336×336）字节完全不变，输出主题 seahorse/original-rig；1 mesh、7 bones、3200 triangles，尾、侧鳍、冠鳍、吻部、腹部五控制点，眼睛区域保护权重。Idle 3s 根骨浮动 6、Move 1.4s 浮动 9 与鳍尾摆动，Attack .72s 后仰蓄力后朝吻部方向释放；60Hz 平滑采样，18 张关键帧。build-seahorse-original-motion.py、preview-seahorse-original-motion.cjs 输出 previews/pet-seahorse-skeleton.html 和 pet-seahorse-original-motion/keyframes-sheet.png。check-seahorse-original-motion.cjs 原图一致、权重归一、全动作网格无翻折（最小有向面积 52.78449）、动态页和原生 Cocos 三动作播放通过，errors=[]。当前仅预览，未接入游戏 Prefab、未打包或发布。

2026-10-10 海马批准后接入 Cocos：import-seahorse-rig.py 导入 assets/resources/gameplay/pets/seahorse-rig，SkeletonData UUID 8a780f81-19c5-48da-8acb-b87e14fadb4a 直接关联 PetRedDragon.prefab.PetFollower.petSkeleton；原 Prefab UUID 保留，停用旧 CharacterAnimation/Animation 并清除 clips。复用宠物骨骼跟随与攻击路径，游戏显示沿用旧 Sprite 的 .467890686 比例、(-18.481682,-.157682) 位置；卡片按 224 可见最长边、(-39.5,1) 中心补偿适配，独立 Rig 循环 Idle、选卡暂停期间继续动画。check-seahorse-rig-source.cjs 注入当前源码及新资源到已有 Cocos 原生运行时：初始 Idle、时间轴推进/.6 秒 rootY=5.7063、Move 不重启、Attack 单次 10 伤害及一次特效、恢复 Move、暂停卡片 Idle、切换其他宠物恢复 Sprite 均通过，错误为空。攻击目标/特效使用计数替身，未证明真实敌人和实体手机效果。TypeScript 检查通过，temp/verification/seahorse-rig/card.png 已查看，未打包、发布或推送。

2026-10-10 鲨鱼原图连续网格预览：沿用海马与水母思路，原 shark/idle/idle-01.png（512×512）不改动，输出主题 shark/original-rig。1 mesh、7 bones、3200 triangles，尾部、胸鳍、背鳍、头部和腹部控制点，保护眼睛区域；尾部主要上下摆动，Idle 3s 根骨浮动6、Move 1.4s 浮动9，Attack .72s 后仰蓄力后朝头部方向远程释放。build-shark-original-motion.py、preview-shark-original-motion.cjs 生成 18 关键帧及 previews/pet-shark-skeleton.html，展示时补偿原图偏右下透明留白。check-shark-original-motion.cjs 验证原图一致、权重、三动作网格无翻折（最小有向面积132.585）、动态页面和原生 Cocos 三动作播放均通过，errors=[]。目前仅预览，尚未接入 PetBlueDragon.prefab，未打包或发布。

2026-10-10 鲨鱼独立部件预览：用户要求拆分，内置 imagegen 参考原图生成透明 source-parts-sheet.png，提示词保存 shark/parts-rig/generation-prompts.json。拆为 body（头身连续）、tail、dorsal、near-fin、far-fin 五独立 PNG，重绘连接区域并按 pivot 拼接；6 bones/5 region slots，Idle 3s、Move 1.4s、Attack .72s。尾、背鳍、远鳍在身体之后，近鳍在身体之前。build-shark-parts-preview.py、preview-shark-parts.cjs 输出 pet-shark JSON/atlas/PNG、18 关键帧和独立部件预览，动态 pet-shark-skeleton.html 改为拆分版本。check-shark-parts-preview.cjs 循环恢复、浏览器和 Cocos 原生三动作通过，尾骨实际角度变化，errors=[]。造型接近原图但生成补画不是像素级一致；尚未接入 PetBlueDragon.prefab、未打包或发布。

2026-10-10 鲨鱼尾巴与身体合并：用户要求尾巴不分割。内置 imagegen 参考原图生成 source-body-tail.png（提示词 generation-prompts-continuous.json），头身尾一张连续贴图，背鳍/近胸鳍/远胸鳍独立；4 slots/6 bones。身体采用40×24加权网格、1920三角形，在尾根40单位区间 smoothstep 混合 body/tail，保留摆尾且无独立尾根接缝。背鳍根部从y44下移到26，确保藏在新躯干轮廓内。build-shark-continuous-parts.py、preview-shark-continuous-parts.cjs 支持混合 mesh/region 渲染，18关键帧及动态 pet-shark-skeleton.html 更新 continuous1。check-shark-parts-preview.cjs 原生 Idle/Move/Attack 与尾骨转动验证通过，errors=[]；旧tail.png仅历史部件，当前图集及slots不引用。未接入游戏、未打包。

2026-10-10 鲨鱼身体尾巴连续版本接入 Cocos：import-shark-rig.py 导入 assets/resources/gameplay/pets/shark-rig，SkeletonData UUID 3e31b441-8719-4539-b75e-7094d23c6afd 直接关联 PetBlueDragon.prefab.PetFollower.petSkeleton，保留原 Prefab UUID、停用旧 CharacterAnimation/Animation 并清除 clips。使用用户批准的4 slots/6 bones 身尾连续 mesh 加独立背鳍和两侧胸鳍，不使用旧五部件分割尾巴版本。按中性姿态 bounds [-145,-87,100,82.12] 适配原可见宽度，显示比例 .5576397、位置(12.546894,-.718870)；卡片最长边245、中心补偿(22.5,2.44)，独立 Rig 循环 Idle，暂停时继续推进。check-shark-rig-source.cjs 注入当前源码及新资源到现有 Cocos 原生运行时：Idle时间轴与 rootY=5.7063、Move 不重启、Attack 单次10伤害/一次特效、结束恢复、暂停卡片待机及切换其他宠物恢复 Sprite 均通过，errors=[]；攻击目标/特效为计数替身，未验证实际敌人和实体手机。TypeScript通过，temp/verification/shark-rig/card.png 已查看。未打包、发布或推送。

2026-10-10 Boss 小范围身体阻挡：用户明确撤销此前无阻挡要求，选择角色走进身体需小范围阻挡。BossController/Boss.prefab 增加 bodyRadiusX=100、bodyRadiusY=55、bodyOffsetY=-50，configureBody 创建/复用 CircleBody2D 椭圆，group/mask=3，与英雄、敌人和宠物交互；Boss 移动走 swept moveTo(slide=true)，不再直接穿入其他角色。BossBattleSystem 出生前配置身体并按 canOccupy 找空位，拥挤时沿原重试流程等待；死亡立即关闭阻挡，受击330×300与攻击参数保持。check-boss-body-source.cjs 注入当前 Boss 源码到原生运行时验证英雄移动到Boss中心被挡、Boss向英雄中心移动被挡、宠物组匹配、Idle/Move、5点单次近战伤害、远程Cast、闭眼下沉及死亡解除阻挡/单次结算，errors=[]。源码TypeScript通过；测试未在用户当前编辑器窗口或实体手机运行，未打包。

2026-10-10 召唤台满额立即选卡：用户要求满额即弹出。MagicLampSystem 删除召唤动画完成等待及 summonElapsed/summonFinished 状态，满额 update 分支和最后一枚正常扣币分支同步 openSelection；pets-ready 回调也不等待动画，并检查当前有效阶段/英雄与召唤台激活。保留预先资源就绪保护、暂停/摇杆关闭、清理飞币及选择后进入下一轮。check-lamp-immediate-selection.cjs 当前源码注入已有原生 Cocos，三轮10/50/100正常逐枚投币在达到门槛的同一 update 调用即 open=true，选择两卡/暂停/单次扣币/恢复及完成三次招募通过，errors=[]。TypeScript检查通过，未打包或发布。

2026-10-10 四宠物骨骼替换后清理并打包：按用户授权运行 clean-unused-assets.py --apply，删除296个不再引用的旧宠物帧及12个旧动画，27,751,341字节（26.47MiB），同时删除匹配meta和空目录；主题源素材保留。TypeScript通过，Cocos web-mobile构建成功（约30秒），压缩离线单HTML build/undersea-adventure-single.html=15,521,794字节（14.80MiB），对比上一19,519,147字节减少20.48%。内部资源gzip=7,538,471字节；保留完整未压缩中间包undersea-adventure-full.html。check-single-html.cjs新包实际离线启动无外部请求/错误，首输入前不计时不生成敌人，移动与音乐、四宠物骨骼引用及三次招募进化、Boss身体阻挡100/55/-50、血量200/伤害5、Boss音乐/胜利恢复通过。本地压缩产物包含当前满额立即选卡源码，未部署或推送。

2026-10-10 整包 gzip 单 HTML：新增 tools/pack-gzip-html.py，压缩完整 compact HTML 后内嵌 Base64，先显示加载页，再使用原生 DecompressionStream 或内置 pako 解压，在原始文档中启动 Cocos。所有465个运行资源仍内嵌，图片与音频不新增有损处理。build-and-pack.ps1 后续自动生成此包；产物 build/undersea-adventure-single.html=10,202,506字节（9.73MiB），比15,521,794字节减少34.27%。原生与备用解压离线回归通过，最终原生回归 errors=[]、external=[]，首输入前不计时不生成敌人，移动/音乐、宠物招募、Boss参数和音乐切换通过。未部署或推送，未验证实体手机加载时长。

2026-10-10 Vercel Git 自动部署：现有 undersea-adventure 项目通过官方 CLI 同等关联 API 绑定 GitHub allan1in/UnderseaAdventure，productionBranch=main 已读回确认。仓库根 vercel.json 直接发布 build 中已跟踪的压缩 single HTML，首页重写到该文件，安装与构建命令留空，无需云端 Cocos；后续需要本地重新打包并提交产物才能发布游戏更新。原域名关联保留。
