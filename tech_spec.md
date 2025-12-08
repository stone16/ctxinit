# **认知 Hypervisor：为 Agentic 软件工程构建统一上下文架构**

## **1\. AI 上下文的认识论：从提示词到架构**

软件工程领域正经历着从“无状态”聊天到“有状态”智能体协作的相变。随着大型语言模型（LLM）进化为具备推理能力的智能体，**上下文管理**已成为核心瓶颈。

我们面临的主要挑战不再是模型不够聪明，而是\*\*“上下文精神分裂 (Context Schizophrenia)”\*\*：不同的工具（CLI, IDE, API）以完全不同的方式感知代码库。

* **Claude Code** 通过层级配置和工具调用**主动导航**上下文。
* **Cursor** 依赖开发者配置的规则系统和显式引用进行**上下文工程**。
* **Codex/ChatGPT** 通过 Projects、Memory 和 MCP Connectors 构建**集成式上下文生态**。

本架构旨在建立一个\*\*"认知 Hypervisor"**，维护项目规则的**单一事实来源 (Single Source of Truth)\*\*，并通过编译管道将其适配给不同的 AI 上下文管理模式。

## **2\. 核心理论：上下文管理频谱 (Context Management Spectrum)**

现代 AI 编码助手并非采用截然不同的认知模式，而是在**上下文管理频谱**上占据不同位置。它们的差异主要体现在：**控制权归属**（Agent、开发者、还是生态系统）和**自动化程度**。

| 维度 | 场景 A: Claude Code | 场景 B: Cursor IDE | 场景 C: Codex / 通用 Agent |
| :---- | :---- | :---- | :---- |
| **管理模式** | **Agent 驱动导航** | **开发者配置工程** | **集成式生态系统** |
| **控制权** | Agent 自主发现上下文 | 开发者主导上下文策划 | 生态系统驱动管理 |
| **机制** | 层级 CLAUDE.md + MCP Servers + 工具调用 | .cursor/rules + @ 符号显式引用 | Projects + Memory + MCP Connectors |
| **自动化程度** | 半自动（Agent 发起，开发者配置） | 手动 + 规则辅助 | 高度自动化 + Agentic 增强 |
| **目标产物** | CLAUDE.md | .cursor/rules/\*.mdc | AGENTS.md |

## **3\. 统一架构实现：元数据驱动**

我们摒弃手动维护下游配置文件的做法，转而维护一个**强类型**的元数据仓库。

### **3.1 目录结构：单一事实来源**

`.context/` 目录是开发者唯一需要维护的地方，**必须提交到 Git 仓库**。编译产物（CLAUDE.md, AGENTS.md, .cursor/rules/*.mdc）可根据团队习惯选择提交或 gitignore。

```
.context/
├── config.yaml            # 编译配置（可选）
├── project.md             # [Global] 项目核心目标、技术栈
├── architecture.md        # [Global] 核心设计模式
└── rules/                 # [Local] 原子化规则库
    ├── backend/           # 领域目录（用于目录级规则选择）
    │   ├── auth.md        # 认证规则
    │   └── db.md
    ├── frontend/
    │   └── ui-kit.md
    └── style/
        └── python.md
```

### **3.2 规则文件格式规范**

每个规则文件必须包含 YAML frontmatter，用于编译时的元数据处理：

```yaml
---
id: "auth-rules"                    # 必需：唯一标识符
description: "认证与授权规则"         # 必需：规则描述
domain: "backend"                   # 必需：领域分类
globs: ["**/auth/**", "**/*.auth.*"] # 可选：文件匹配模式
priority: 80                        # 可选：优先级 0-100，默认 50
tags: ["security", "critical"]      # 可选：标签，用于规则选择
---

# 认证规则内容

实际的规则 Markdown 内容...
```

**编译产物格式（.cursor/rules/*.mdc）：**

```yaml
---
description: "认证与授权规则"    # 来自源文件
globs: ["**/auth/**"]          # 来自源文件或目录路径推断
alwaysApply: false             # 默认 false
---

# 规则内容（编译自源文件）
```

### **3.3 规则选择策略**

为控制编译产物大小（CLAUDE.md 建议 < 100 行），编译器支持多种规则选择策略：

| 策略 | 描述 | 配置示例 |
| :---- | :---- | :---- |
| **目录过滤** | 根据规则所在目录选择 | `include_dirs: ["backend", "style"]` |
| **Glob 匹配** | 根据当前工作文件匹配 | 自动根据 globs 字段筛选 |
| **优先级排序** | 按 priority 降序，填满 Token 预算 | `max_tokens: 4000` |
| **标签过滤** | 根据 tags 字段选择 | `include_tags: ["critical", "security"]` |

**配置示例 (.context/config.yaml)：**

```yaml
compile:
  claude:
    max_tokens: 4000
    strategy: "priority"
    always_include: ["project.md", "architecture.md"]
  cursor:
    strategy: "all"  # Cursor 支持多文件，不需要筛选
  agents:
    max_tokens: 8000
    strategy: "directory"
    include_dirs: ["backend", "frontend"]

conflict_resolution:
  strategy: "priority_wins"  # 多规则匹配同一文件时，高优先级胜出
  fallback: "merge"          # 优先级相同时合并内容
```

### **3.4 静态检查与验证 (Static Analysis)**

为了防止配置错误，`ctx build` 必须包含严格的静态检查。我们使用内置的 **ctx-lint** 工具确保所有源文件和编译产物符合规范。

**基础检查（阻止编译）：**

1. **Schema 验证**：确保 id, description, domain 必需字段存在且合法。
2. **死链检测 (Dead Link Check)**：扫描 Markdown 中的 \[Link\](path) 和 @path，确保目标文件真实存在。
3. **重复 ID 检测**：确保所有规则的 id 字段全局唯一。

**增强检查（警告但不阻止）：**

4. **空 Glob 检测 (Ghost Rule Check)**：警告那些 globs 匹配不到任何文件的规则（可能是重构后遗留的废规则）。
5. **循环引用检测**：检测规则 A 引用规则 B，B 又引用 A 的情况。
6. **Token 超限预警**：当编译产物预计超过目标平台限制时发出警告（CLAUDE.md > 4K tokens, .mdc > 10K tokens）。

**实现依赖：**

- 使用 **fast-glob** 替代 glob 包（避免 CVE-2025-64756 安全漏洞）
- 使用 **remark-lint-frontmatter-schema** 进行 frontmatter 验证
- 使用 **Ajv** 或 **Zod** 进行 JSON Schema 验证

## **4\. 编译流水线 (The Compiler Pipeline)**

用户通过 `ctx build` 触发生成。编译器直接从 `.context/` 生成三种目标产物，无需中间文件。

**编译产物：**
```
项目根目录/
├── CLAUDE.md              # Claude Code 入口文件
├── AGENTS.md              # Codex/通用 Agent 入口文件
└── .cursor/
    └── rules/
        ├── backend-auth.mdc
        ├── backend-db.mdc
        └── frontend-ui-kit.mdc
```

### **4.1 策略 A：面向 Cursor 的原生注入 (.mdc)**

**核心原则**：利用 Cursor 的多文件规则系统，每个规则独立编译。

* **逻辑**：将 `.context/rules/` 下的每个文件直接编译为 `.cursor/rules/*.mdc`。
* **Glob 推断**：如果源文件未指定 globs，则根据目录路径自动推断（如 `backend/auth.md` → `globs: ["**/backend/**"]`）。
* **结果**：当用户打开 auth.ts 时，Cursor 根据 globs 匹配自动加载相关规则。

### **4.2 策略 B：面向 Claude Code 的入口文件**

**核心原则**：生成精简的 CLAUDE.md 入口，控制 Token 预算。

* **内容组成**：
  1. `project.md` 核心内容（项目目标、技术栈）
  2. `architecture.md` 摘要（关键设计模式）
  3. 根据规则选择策略筛选的高优先级规则
  4. `.context/` 目录索引（Agent 可按需读取完整规则）
* **Token 控制**：默认 < 4000 tokens，可通过 `config.yaml` 调整。

### **4.3 策略 C：面向通用 Agent 的 AGENTS.md**

**核心原则**：提供完整的项目上下文，适配 Codex 等无特定格式要求的工具。

* **内容组成**：
  1. 完整的 `project.md` 内容
  2. 完整的 `architecture.md` 内容
  3. 规则目录索引和摘要
* **Token 控制**：默认 < 8000 tokens。

### **4.4 增量编译 (Incremental Build)**

为提升编译性能，编译器采用增量编译策略：

**变更检测机制：**
```yaml
# .context/.build-manifest.json（自动生成，不提交）
{
  "version": "1.0",
  "lastBuild": "2024-12-07T10:30:00Z",
  "files": {
    "rules/backend/auth.md": {
      "hash": "sha256:a1b2c3...",
      "mtime": 1701943800,
      "compiledTo": [".cursor/rules/backend-auth.mdc", "CLAUDE.md"]
    }
  }
}
```

**编译流程：**
1. **快速检查**：比较文件修改时间（mtime）
2. **精确验证**：如果 mtime 变化，计算内容哈希确认是否真的改变
3. **依赖追踪**：如果规则 A 引用规则 B，B 变更时也重新编译 A
4. **增量输出**：只重新生成受影响的编译产物

## **5\. 自动化工作流：从初始化到提交**

采用 **Git Hooks** 策略确保规则与编译产物的一致性。

### **5.1 初始化 (The Setup)**

```bash
# 新项目初始化
npx ctxinit

# 或全局安装后
ctxinit
```

**初始化流程：**

1. **ctxinit**: 创建 `.context/` 目录结构，生成模板文件。
2. **Agent 选择**: 交互式选择目标平台（Cursor/Claude/All）。
3. **环境固化**:
   * 自动安装 husky（如果未安装）。
   * 配置 `.gitignore`（可选）：
     ```gitignore
     # 编译产物（可选择提交或忽略）
     # .cursor/rules/*.mdc
     # CLAUDE.md
     # AGENTS.md

     # 编译缓存（始终忽略）
     .context/.build-manifest.json
     ```

### **5.2 日常开发循环 (The Dev Loop)**

1. **修改规则**: 开发者编辑 `.context/rules/auth.md`。
2. **提交代码**: 运行 `git commit`。
3. **Pre-commit Hook 触发**:
   * 运行 `ctx build --incremental`。
   * **静态检查**：Schema 错误或死链**阻止提交**并报错。
   * **警告提示**：Ghost Rule、Token 超限等问题显示警告但不阻止。
   * **自动更新**：更新编译产物（CLAUDE.md, AGENTS.md, .cursor/rules/*.mdc）。

### **5.3 渐进式采用与迁移策略**

对于已有 `.cursorrules`、`CLAUDE.md` 或 `AGENTS.md` 的项目，采用**附加模式 (Attach Mode)** 渐进迁移：

**Phase 1: 评估与并行**
```bash
# 分析现有配置
ctxinit --analyze

# 输出示例：
# Found existing files:
#   .cursorrules (1.2KB, 45 lines)
#   CLAUDE.md (800B, 30 lines)
# Recommended: Attach mode migration
```

**Phase 2: 附加模式初始化**
```bash
# 保留现有文件，创建 .context/ 目录
ctxinit --attach

# 这将：
# 1. 创建 .context/ 目录
# 2. 将现有规则导入为 .context/rules/legacy.md
# 3. 保留原有文件不变
# 4. 新编译产物追加而非覆盖
```

**Phase 3: 逐步迁移**
```yaml
# .context/config.yaml
migration:
  mode: "attach"                    # attach | replace | parallel
  preserve_legacy: true             # 保留原有文件
  legacy_files:
    - ".cursorrules"                # 这些文件内容将被追加到编译产物
    - "CLAUDE.md"
  migration_complete: false         # 完成迁移后改为 true
```

**Phase 4: 验证与切换**
```bash
# 对比编译产物与原文件
ctx diff --legacy

# 确认无功能损失后，完成迁移
ctxinit --complete-migration
# 这将删除 legacy 标记并清理原有文件
```

## **6\. 自愈与审计 (Self-Healing & Auditing)**

除了静态检查，我们在编译产物中嵌入"软性审计"提示。

**Meta-Rule（嵌入所有编译产物）：**

```markdown
<!-- Context Hygiene -->
🛡️ **Context Hygiene Notice**

This file is auto-generated from `.context/` source files.

- **DO NOT** edit this file directly.
- If you notice outdated rules compared to actual code, alert the user to update `.context/rules/`.
- Source of Truth: `.context/` directory.
- Regenerate: Run `ctx build` after editing source files.
```

**运行时审计（可选）：**

编译器可生成校验哈希，供 AI Agent 验证编译产物是否最新：

```yaml
# 嵌入 CLAUDE.md 的校验信息
<!-- ctx-checksum: sha256:abc123... -->
<!-- ctx-build-time: 2024-12-07T10:30:00Z -->
```

## **7\. 结论**

本架构采用**元数据驱动的编译模式**，实现"一份源文件，多处适配"：

1. **单一事实来源**：`.context/` 目录是唯一需要维护的规则仓库，必须提交到 Git。
2. **智能编译**：根据目标平台（Cursor/Claude/Codex）生成优化的编译产物。
3. **规则选择**：通过 glob、目录、优先级、标签等策略控制编译产物大小。
4. **增量编译**：基于内容哈希的增量编译，提升大型项目的编译性能。
5. **静态验证**：Schema 验证、死链检测、循环引用检测等确保规则质量。
6. **渐进迁移**：Attach Mode 支持现有项目平滑迁移。
7. **Git Hooks 集成**：Pre-commit 触发编译，确保规则与产物一致性。

## **8\. 后续规划 (Phase 2)**

以下功能将在 Phase 2 中实现：

1. **更多工具支持**：GitHub Copilot、Windsurf、Amazon Q Developer 等。
2. **团队协作功能**：规则继承、覆盖、团队共享库。
3. **可视化管理**：Web UI 或 VSCode 插件用于规则管理。
4. **规则市场**：社区规则模板的发现与共享。