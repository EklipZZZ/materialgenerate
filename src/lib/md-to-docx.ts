import JSZip from 'jszip';
import { marked } from 'marked';

interface Token {
  type: string;
  text?: string;
  depth?: number;
  items?: Token[];
  raw?: string;
  lang?: string;
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 将 Markdown 转换为 DOCX Buffer
 */
export async function markdownToDocx(markdown: string, title: string = '文档'): Promise<Buffer> {
  const zip = new JSZip();
  
  // 解析 Markdown
  const tokens = marked.lexer(markdown) as Token[];
  
  // 生成 document.xml 内容
  let documentContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>`;

  // 添加标题
  documentContent += `
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
    </w:rPr>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
    </w:rPr>
    <w:t>${escapeXml(title)}</w:t>
  </w:r>
</w:p>`;

  // 处理 Markdown tokens
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const fontSize = token.depth === 1 ? 28 : token.depth === 2 ? 24 : token.depth === 3 ? 22 : 20;
        documentContent += `
<w:p>
  <w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="${fontSize}"/>
    </w:rPr>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:b/>
      <w:sz w:val="${fontSize}"/>
    </w:rPr>
    <w:t>${escapeXml(token.text || '')}</w:t>
  </w:r>
</w:p>`;
        break;
      }
      
      case 'paragraph': {
        documentContent += `
<w:p>
  <w:r>
    <w:t>${escapeXml(token.text || '')}</w:t>
  </w:r>
</w:p>`;
        break;
      }
      
      case 'list': {
        if (token.items) {
          for (const item of token.items) {
            documentContent += `
<w:p>
  <w:pPr>
    <w:ind w:left="720"/>
  </w:pPr>
  <w:r>
    <w:t>• ${escapeXml(item.text || '')}</w:t>
  </w:r>
</w:p>`;
          }
        }
        break;
      }
      
      case 'code': {
        const lines = (token.text || '').split('\n');
        for (const line of lines) {
          documentContent += `
<w:p>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>
      <w:sz w:val="20"/>
    </w:rPr>
    <w:t>${escapeXml(line)}</w:t>
  </w:r>
</w:p>`;
        }
        break;
      }
      
      case 'blockquote': {
        documentContent += `
<w:p>
  <w:pPr>
    <w:ind w:left="720"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:i/>
    </w:rPr>
    <w:t>${escapeXml(token.text || '')}</w:t>
  </w:r>
</w:p>`;
        break;
      }
      
      case 'space': {
        // 空行
        documentContent += `
<w:p/>`;
        break;
      }
    }
  }

  documentContent += `
</w:body>
</w:document>`;

  // [Content_Types].xml
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  // _rels/.rels
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  // word/_rels/document.xml.rels
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  // 添加文件到 ZIP
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', documentContent);
  zip.file('word/_rels/document.xml.rels', documentRels);

  // 生成 ZIP buffer
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer;
}

/**
 * 简单的 Markdown 清理函数
 */
export function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
