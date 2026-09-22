# 半程马拉松国家三级运动员训练管理网站

当前交付：**Checkpoint 5：移动端、PWA、部署与基础自动化测试**。

这是姚俊豪个人专属的单用户训练管理 Web App，目标是冲击男子半程马拉松国家三级运动员成绩 **1:21:30**。系统坚持真实数据库、真实打卡、真实统计、真实 AI 建议、版本备份与恢复闭环；浏览器端不直接访问 Supabase，不暴露 Service Role Key 或 AI Key。


## 一键本地运行脚本

项目根目录已提供跨平台一键脚本：

### macOS / Linux

```bash
chmod +x run-local.sh
./run-local.sh
```

### Windows PowerShell

```powershell
./run-local.ps1
```

### 也可以用 npm / pnpm

```bash
pnpm run setup
# 或
npm run setup
```

脚本会自动完成：

1. 检查 Node.js 版本；
2. 生成或更新 `.env`；
3. 输入访问码并生成 `APP_ACCESS_CODE_HASH`；
4. 安装依赖；
5. 执行 `pnpm seed` / `npm run seed`；
6. 启动 `dev` 服务；
7. 打开后访问 `http://localhost:3000`。

注意：脚本不会自动替你创建 Supabase 数据库表。第一次运行前，请先在 Supabase SQL Editor 中按顺序执行：

```text
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_ai_apply_suggestion.sql
supabase/migrations/0003_advanced_management.sql
```

如果你已经导入过旧训练计划，想用当前 seed 计划替换未打卡的旧计划，可以运行：

```bash
./run-local.sh --replace-plan
```

常用参数：

```bash
./run-local.sh --no-install   # 跳过依赖安装
./run-local.sh --no-seed      # 跳过 seed
./run-local.sh --no-dev       # 只配置和初始化，不启动 dev
./run-local.sh --replace-plan # seed 时替换未打卡的旧计划
```

## 技术栈

- Next.js App Router + Route Handlers
- React + TypeScript
- Tailwind CSS
- shadcn/ui 风格基础组件
- Recharts
- Supabase PostgreSQL
- Vercel
- PWA + Service Worker + IndexedDB pending_logs
- 服务端 AI Provider 抽象
- Zod 参数校验与 AI JSON 校验
- PostgreSQL RPC 事务函数
- Vitest + Playwright 基础测试

## 已完成模块

### Checkpoint 1：数据库与基础架构

- Supabase SQL：12 张表、约束、索引、唯一约束、`updated_at` trigger
- 可重复执行 seed
- seed 默认写入上传的专项训练总方案：7 个年度阶段 + 12 周逐日训练计划
- 服务端 Supabase client
- 单用户访问码模式
- HttpOnly Cookie
- 访问码错误限流
- `/api/health`
- `.env.example`

### Checkpoint 2：核心训练闭环

- `/dashboard`：今日训练、周/月跑量、训练天数、完成率、阶段、体重、目标、风险、今日建议
- `/week`：周一到周日训练计划、查看详情、跳过训练、新增临时训练
- `/workout/[id]`：单次训练详情、基础打卡、高级字段折叠、重复打卡更新原记录
- `/stats`：Recharts 基础统计图表
- `lib/risk.ts`：本地风险规则
- 打卡写入 `workout_logs`，并更新 `workouts.completed/skipped`
- 重复打卡通过 `workout_logs.workout_id` 唯一约束 + upsert 更新
- 创建/修改/删除训练和打卡写入 `audit_logs`

### Checkpoint 3：AI 与版本闭环

- `/ai-coach`：AI 今日建议、AI 周计划调整、建议预览、用户确认后应用
- `/versions`：查看 `plan_versions` 版本备份和 before/after 数据
- `lib/ai/provider.ts`：统一 `callAI({ task, prompt, schema })`
- AI 建议保存到 `ai_suggestions`
- AI 不会自动覆盖训练计划
- 点击「应用到计划」后才写入 `workouts`
- 应用前自动创建 `plan_versions` 备份
- 应用失败通过 PostgreSQL 函数事务整体回滚
- 应用成功写入 `audit_logs`
- AI 接口基础限流

### Checkpoint 4：高级训练管理

- `/plan`：年度训练阶段列表、新增、编辑、删除
- `/calendar`：月历显示训练，完成/跳过/高强度/长距离/测试日标记，支持快速新增训练
- `/tests`：记录 3km、5km、10km、15km、半马测试，自动计算均配和半马预测
- `/body`：记录体重、睡眠、疲劳、疼痛、静息心率、恢复评分
- `/versions`：支持恢复历史版本；恢复前自动备份当前版本
- CSV：训练计划导入前预览冲突，确认后事务写入；导出训练计划/打卡/测试/体重恢复 CSV
- JSON：导出完整备份；恢复前校验预览；确认后事务恢复；恢复前自动完整备份
- `supabase/migrations/0003_advanced_management.sql`：CSV 导入、版本恢复、JSON 恢复事务函数

### Checkpoint 5：移动端、PWA、部署

- 手机端底部导航：首页、计划、日历、统计、我的
- 电脑端侧边栏完整导航：Dashboard、年度计划、周计划、日历、数据统计、测试成绩、体重恢复、目标页、AI 教练、版本管理、设置
- `/goal`：唯一目标页，目标日期为空时显示“目标比赛暂未设置”
- `/settings`：个人资料、目标比赛、每周最多训练天数、访问密码开关、深色模式、PWA、通知、AI 模型配置、数据导出
- PWA manifest、图标、Service Worker、离线页
- 缓存页面壳
- 支持离线查看最近 7 天训练计划
- 支持离线填写 `pending_logs`
- 网络恢复后提示同步 pending logs
- 云端已有打卡时提示：保留云端 / 覆盖云端 / 合并备注
- 同步成功后清除本地 pending log
- 新增 API：
  - `GET /api/profile`
  - `PUT /api/profile`
  - `GET /api/settings`
  - `PUT /api/settings`
  - `GET /api/offline/recent-workouts`
  - `POST /api/offline/sync-pending-logs`
  - `POST /api/offline/resolve-conflict`
- 补齐 AI API：`/api/ai/phase-review`、`/api/ai/risk-analysis`、`/api/ai/generate-plan`
- Playwright E2E 测试骨架

## 本地运行步骤

### Windows 一键运行（推荐）

如果 PowerShell 提示 `.ps1` 未签名，请直接使用 CMD 或双击运行：

```bat
run-local.bat
```

也可以在命令提示符中运行：

```bat
cd /d D:\桌面\项目\half-marathon-training-cp5
run-local.bat
```

常用参数：

```bat
run-local.bat --no-install
run-local.bat --no-seed
run-local.bat --no-dev
run-local.bat --replace-plan
```

如果一定要运行 PowerShell 版本，可临时绕过当前进程的执行策略：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\run-local.ps1
```


```bash
pnpm install
cp .env.example .env
pnpm access:hash 你的访问码
```

把输出的 `sha256:...` 写入 `.env`：

```env
APP_ACCESS_CODE_HASH=sha256:...
```

本地 HTTP 开发时保留：

```env
ALLOW_INSECURE_DEV_COOKIE=true
```

部署到 Vercel 时删除该变量或设为 `false`，Cookie 会使用 `HttpOnly + Secure + SameSite=Lax`。

## Supabase 初始化步骤

1. 新建 Supabase 项目。
2. 打开 Supabase Dashboard → SQL Editor。
3. 依次执行：
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_ai_apply_suggestion.sql`
   - `supabase/migrations/0003_advanced_management.sql`
4. 在 `.env` 填入：

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_ACCESS_CODE_HASH=sha256:...
APP_TIMEZONE=Asia/Shanghai
AI_API_KEY=你的 AI Key
AI_MODEL=你的模型名
AI_BASE_URL=https://your-ai-provider.example/v1/chat/completions
```

不要把 `SUPABASE_SERVICE_ROLE_KEY` 或 `AI_API_KEY` 写入任何 `NEXT_PUBLIC_` 环境变量。

## Seed 执行步骤

```bash
pnpm seed
```

可选固定 seed 开始日期：

```bash
SEED_START_DATE=2026-05-25 pnpm seed
```

seed 会 upsert：

- `profile`：姚俊豪基础资料
- `app_settings`：单用户基础配置
- `training_phases`：来自专项训练总方案的 7 个训练阶段
- `workouts`：根据 `deep-research-report.md` 结构化后的前 12 周逐日训练计划，共 84 条
- `plan_versions`：记录本次专项方案初始化来源和周跑量摘要

默认 seed 开始日期是 `2026-05-25`，与上传方案中的“从 2026-05-25 当周起算”保持一致。`planned_distance_km` 根据每周目标跑量中值和训练时长/训练类型分配；原文中的距离或时间、配速/RPE、力量安排和注意事项保留在 `main_set` / `notes` 字段中。

重复运行 seed 不会重复插入同一天同类型同标题的训练。若你已经跑过旧版 seed，想在测试库中替换同一窗口内未完成/未跳过的旧计划，可临时运行：

```bash
SEED_REPLACE_EXISTING_PLAN=true pnpm seed
```

正式库谨慎使用该变量；已有打卡日志的训练仍建议先导出 JSON 备份。

## 启动

```bash
pnpm dev
```

打开：

```text
http://localhost:3000
```

根路径会跳转 `/dashboard`。首次访问会在当前页面弹出访问码输入框，不会跳转 `/login`。

## JSON 备份恢复说明

- 打开 `/versions`。
- 点击导出 JSON，会下载完整备份。
- 导入 JSON 时先预览格式和影响范围。
- 确认恢复后，数据库函数会先创建当前数据备份，再事务恢复。
- 恢复失败会回滚，不允许出现一半成功一半失败。

## PWA 与离线打卡验证

1. 在 Chrome DevTools → Application 确认 `manifest.webmanifest` 和 `sw.js` 已注册。
2. 手机端打开 Vercel 域名，使用浏览器菜单添加到桌面。
3. 在线时进入 `/week`，系统会缓存最近 7 天训练计划。
4. 切换离线模式，进入 `/week` 可看到缓存训练。
5. 离线进入某个 `/workout/[id]`，保存打卡。
6. 打卡会进入浏览器 IndexedDB 的 `pending_logs`，不会作为主存储。
7. 网络恢复后底部出现同步提示。
8. 点击同步：
   - 云端无打卡：写入 `workout_logs`，同步成功后清除 pending log。
   - 云端已有打卡：提示保留云端 / 覆盖云端 / 合并备注。

## API 验证

未验证访问码时，受保护 API 应返回 401：

```bash
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/dashboard
curl -i http://localhost:3000/api/settings
```

验证访问码并保存 Cookie：

```bash
curl -i -c cookies.txt \
  -H 'content-type: application/json' \
  -d '{"accessCode":"你的访问码"}' \
  http://localhost:3000/api/access/verify
```

带 Cookie 请求：

```bash
curl -i -b cookies.txt http://localhost:3000/api/health
curl -i -b cookies.txt http://localhost:3000/api/dashboard
curl -i -b cookies.txt http://localhost:3000/api/workouts
curl -i -b cookies.txt http://localhost:3000/api/settings
curl -i -b cookies.txt http://localhost:3000/api/offline/recent-workouts
curl -i -b cookies.txt http://localhost:3000/api/export/json
```

## 数据库写入验证

```sql
select count(*) from profile;
select count(*) from training_phases;
select count(*) from workouts;
select count(*) from workout_logs;
select count(*) from plan_versions;
select count(*) from audit_logs;
```

验证重复打卡不会新增多条有效记录：

```sql
select workout_id, count(*)
from workout_logs
group by workout_id
having count(*) > 1;
```

应无结果。

## 测试

Vitest：

```bash
pnpm test
```

Playwright：

```bash
pnpm exec playwright install
pnpm test:e2e
```

E2E 测试需要先启动本地服务，并在测试环境中配置可用的 Supabase 和访问码。

## Vercel 部署步骤

1. 将项目推送到 GitHub。
2. Vercel → New Project → 导入仓库。
3. Framework Preset 选择 Next.js。
4. 配置环境变量：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_ACCESS_CODE_HASH`
   - `APP_TIMEZONE=Asia/Shanghai`
   - `AI_API_KEY`
   - `AI_MODEL`
   - `AI_BASE_URL` 可选
5. 不要在 Vercel 设置 `ALLOW_INSECURE_DEV_COOKIE=true`。
6. 部署后打开根路径，确认跳转 `/dashboard` 并弹出访问码。
7. 进入 `/api/health`，确认数据库连接正常。

## 常见问题排查

- 访问码正确但仍 401：确认 `APP_ACCESS_CODE_HASH` 是 `pnpm access:hash` 生成的值；生产环境 Cookie 必须在 HTTPS 下才能 Secure 生效。
- `/api/health` database 失败：检查 Supabase URL 和 Service Role Key。
- AI 不可用：确认 `AI_API_KEY`、`AI_MODEL`、`AI_BASE_URL`。AI 失败不会影响 Dashboard、打卡、统计。
- 页面无训练数据：先执行 `pnpm seed`，或在 `/week` 新增训练。
- PWA 不能安装：确认生产环境 HTTPS，且 manifest 和 service worker 可以访问。
- 离线无训练：必须先在线打开 `/week` 或 `/api/offline/recent-workouts` 让最近 7 天计划进入缓存。

## 部署后检查清单

1. Vercel 环境变量是否配置。
2. Supabase 连接是否成功。
3. 访问码是否生效。
4. `/api` 是否受保护。
5. `/api/health` 是否正常。
6. Dashboard 是否能读取数据库。
7. 打卡是否能写入数据库。
8. 统计是否随打卡变化。
9. AI Key 是否可用。
10. AI 建议是否能保存。
11. 版本备份是否能创建。
12. JSON 备份是否能导出。
13. 手机端是否能添加到桌面。
14. 手机端打卡是否无横向滚动。
15. Vercel 部署后刷新不报错。

## 安全原则

- 不创建 `/login`。
- 不使用 Supabase Auth。
- 不创建多用户系统。
- Supabase Service Role Key 只在服务端环境变量中使用。
- AI Key 只在服务端环境变量中使用。
- 前端只调用 `/api/*`。
- 访问 Cookie 使用 HttpOnly、Secure、SameSite=Lax。
- 离线 IndexedDB 只保存 pending logs 和最近计划缓存，不作为主数据库。

### Windows CMD 一键运行

如果 PowerShell 提示 `.ps1 未签名`，请不要运行 `run-local.ps1`，改用 CMD：

```bat
cd /d D:\桌面\项目\half-marathon-training-cp5
run-local.bat
```

`run-local.bat` 使用纯 ASCII 编码，避免 Windows CMD 把 UTF-8 BOM 识别成 `锘緻echo`。
第一次运行时必须粘贴真实的 Supabase Project URL 和 Service Role Key，不能直接回车保留 `.env.example` 里的占位值。
