# DOCX 转 PDF 服务

这是软著应用的隔离转换服务。它只接收 DOCX，使用 LibreOffice Writer 转成 PDF，并立即删除临时文件。

环境变量：

- `CONVERTER_SHARED_SECRET`：与 Vercel 中相同的高强度随机密钥；
- `PORT`：由托管平台自动提供。

接口：

- `GET /health`：公开健康检查；
- `POST /convert/docx-to-pdf`：请求体为原始 DOCX 二进制，必须携带 `x-converter-secret`。

容器不需要、也不应配置 Supabase service-role、数据库连接串或模型 API Key。
