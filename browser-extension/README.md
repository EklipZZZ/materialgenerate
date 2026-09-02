# 软著申报助手 Chrome 扩展（内测版）

这是软著网页应用的浏览器执行层。扩展只在网页应用和中国版权保护中心 R11 页面运行，不读取 Cookie、历史记录或密码，也不接收 Supabase Token。

## 构建

在项目根目录执行：

```bash
pnpm extension:build
```

默认构建到 `browser-extension/dist`，目标网页应用是 `https://ipgen.top`。本地开发时需要显式设置本地 origin：

```powershell
$env:SOFTREG_APP_ORIGIN="http://localhost:3000"
$env:SOFTREG_STORAGE_ORIGIN="https://your-project.supabase.co"
pnpm extension:build
```

部署到其他 HTTPS 域名时，将 `SOFTREG_APP_ORIGIN` 替换为实际网页应用 origin。生产构建不会自动加入 localhost 或 `127.0.0.1`。

生产环境必须使用 HTTPS。`SOFTREG_STORAGE_ORIGIN` 只能是当前 Supabase 项目的 Storage 所在 origin，构建脚本会拒绝不安全或带路径的配置。

## Chrome 加载

1. 打开 `chrome://extensions`，开启“开发者模式”。
2. 点击“加载已解压的扩展程序”，选择 `browser-extension/dist`。
3. 点击扩展卡片上的刷新按钮，再刷新软著网页应用页面。
4. 打开已保存的申请详情页或材料生成页，确认页面显示“扩展已连接”。扩展没有独立弹窗，加载完成本身不会自动打开网页或启动任务。
5. 点击网页应用中的“开始自动填报”后，扩展会打开 R11 入口。

官方登录、验证码、短信/实名验证、签章页打印签章和最终提交始终由用户完成。扩展在表单填写后先暂停供用户复核，材料上传完成后也不会点击最终提交。

扩展只接受来自当前网页应用 origin 的严格协议消息。短期材料下载地址只存在于本次浏览器内存中，网页关闭或扩展重启后需要在网页应用中点击“继续填报”重新配对。

## 发布

内测阶段使用上述“加载已解压的扩展程序”。正式使用时，应由维护者构建并发布 Chrome Web Store 未公开链接或公开版本，不能把开发者模式安装教程作为面向普通用户的长期方案。
