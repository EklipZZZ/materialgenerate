## Project Overview
- **Name**: Soft Copyright Application Automation Workflow
- **Function**: Automatically generate source code Markdown, user manual Markdown, and completed collection form JSON for soft copyright application

### Node List
| Node Name | File Location | Type | Description | Branch Logic | Config File |
|-----------|--------------|------|-------------|--------------|-------------|
| template_analysis | `nodes/template_analysis_node.py` | agent | Read JSON collection form and complete all fields | - | `config/template_analysis_cfg.json` |
| source_code_generation | `nodes/source_code_generation_node.py` | agent | Generate complete source code in Markdown format | - | `config/source_code_generation_cfg.json` |
| documentation_generation | `nodes/documentation_generation_node.py` | agent | Generate user manual in Markdown format | - | `config/documentation_generation_cfg.json` |
| submission_preparation | `nodes/submission_preparation_node.py` | task | Generate three Markdown files and upload to storage | - | - |

**Type Description**: task(task node) / agent(Large Language Model) / condition(conditional branch) / looparray(list loop) / loopcond(conditional loop)

## Subgraph List
| Subgraph Name | File Location | Description | Called By Node |
|--------------|--------------|-------------|----------------|
| - | - | - | - |

## Skills Used
- Node `template_analysis` uses skill: Large Language Model (LLM)
- Node `source_code_generation` uses skill: Large Language Model (LLM)
- Node `documentation_generation` uses skill: Large Language Model (LLM)
- Node `submission_preparation` uses skill: Object Storage (S3)

## Workflow Process
1. **Template Analysis** (template_analysis): Read JSON collection form template, complete all blank fields with appropriate content
2. **Parallel Processing** (execute following two nodes simultaneously):
   - **Source Code Generation** (source_code_generation): Generate complete source code in Markdown format (3-5 core files)
   - **Documentation Generation** (documentation_generation): Generate detailed user manual in Markdown format
3. **Submission Preparation** (submission_preparation): Generate three files and upload to storage:
   - **Source Code Markdown**: Complete source code in Markdown format with code blocks
   - **User Manual Markdown**: Software manual with detailed function descriptions
   - **Collection Form JSON**: Completed collection form with all fields filled
   - Upload to storage and generate 30-minute validity download links

## Input/Output
**Input**:
- template_file: Collection form template file (JSON format)

**Output**:
- source_code_markdown: Source code Markdown file path
- documentation_markdown: User manual Markdown file path
- collection_form_json: Completed collection form JSON file path
- download_links: **Download links for three documents (30 minutes validity)** ⭐
  - source_code_markdown: Download URL for source code
  - documentation_markdown: Download URL for user manual
  - collection_form_json: Download URL for collection form

**Important**: 
- File paths are on the server and cannot be accessed directly
- **Use the download_links to download the three files**
- Download links are valid for 30 minutes after generation

## Output File Description

### 1. Source Code Markdown
- **Local filename**: source_code.md
- **Storage filename**: source_code_[hash1]_[hash2].md
- **Content**: Complete source code in Markdown format with code blocks
- **Format features**:
  - Multiple source files (config.py, main.py, models.py, utils.py, api.py, etc.)
  - Each file wrapped in ```python code block
  - Detailed Chinese comments for each file
  - Code reflects software's main functions and technical features

### 2. User Manual Markdown
- **Local filename**: user_manual.md
- **Storage filename**: user_manual_[hash1]_[hash2].md
- **Content**: Complete user manual in Markdown format
- **Format features**:
  - Software overview (name, version, classification, etc.)
  - Detailed function descriptions for each module
  - Operation instructions with specific steps
  - Software runtime environment (hardware, software)
  - Installation and deployment process
  - Technical features and innovations
  - Appendices (glossary, technical support)

### 3. Collection Form JSON
- **Local filename**: collection_form.json
- **Storage filename**: collection_form_[hash1]_[hash2].json
- **Content**: Completed collection form with all fields filled
- **Format**: JSON format, consistent with template structure
- **Features**:
  - All blank fields completed with appropriate content
  - Existing information preserved
  - Content consistent with software information
  - Meets character limits

## Usage Instructions
1. Prepare collection form template file (JSON format)
2. Run workflow, pass template file
3. Workflow automatically generates:
   - Source code in Markdown format
   - User manual in Markdown format
   - Completed collection form JSON
4. Get download links for three documents (30 minutes validity)
5. Download three documents for soft copyright application

## Important Notes
- Source code generates 3-5 core Python files with detailed comments
- User manual uses Markdown format with complete function descriptions
- Collection form fields are completed intelligently based on software information
- All three files are automatically uploaded to object storage with 30-minute validity presigned download links
- Download links format: `download_links["source_code_markdown"]`, `download_links["documentation_markdown"]`, `download_links["collection_form_json"]`
- All outputs are in text-based formats (Markdown and JSON), easy to view and edit
