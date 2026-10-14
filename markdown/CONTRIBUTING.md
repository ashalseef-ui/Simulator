# Contributing to WireCraft

> [📖 Doc Hub](./INDEX.md) • [🏗️ Architecture](./ARCHITECTURE.md) • [💻 CLI Reference](./CLI_REFERENCE.md) • [🔌 REST API](./API.md) • [🧪 Testing](./TESTING.md) • [🚀 Deployment](./DEPLOYMENT.md) • [🔒 Security](./SECURITY.md) • [🗺️ Roadmap](./ROADMAP.md) • [🏷️ Brand Guide](./BRAND_LOC.md) • [🤝 Contributing](./CONTRIBUTING.md)

Thank you for your interest in contributing to **WireCraft**! We welcome contributions from network engineers, software developers, educators, and students. This document outlines our engineering standards, development workflow, and pull request requirements.

---

## 1. Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it to understand our community standards and expectations.

---

## 2. Getting Started

### Prerequisites

- **Node.js**: `v22.0.0` or higher
- **npm**: `v10.0.0` or higher
- **Git**

### Local Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/<your-username>/wirecraft.git
   cd wirecraft
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   *(Optionally provide a `GEMINI_API_KEY` to test AI TAC and diagram generation features).*
4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The application is available at `http://localhost:3000`.

---

## 3. Development Workflow & Git Standards

### Branching Strategy

We follow a structured Git feature branch workflow:

- `main`: Production-ready, stable codebase.
- `feat/<feature-name>`: New features, UI additions, or simulation capabilities.
- `fix/<bug-description>`: Bug fixes and engine corrections.
- `docs/<doc-topic>`: Documentation updates.
- `test/<test-scope>`: Test suite enhancements or property-based tests.

### Commit Message Guidelines (Conventional Commits)

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description in present tense>

[optional body explaining rationale and technical context]

[optional footer(s) e.g., Fixes #123]
```

#### Allowed Types:
- `feat`: A new user-facing feature or CLI command capability.
- `fix`: A bug fix in simulation engines, UI, or backend routing.
- `docs`: Documentation changes only (e.g., markdown files).
- `test`: Adding missing tests or correcting existing tests.
- `refactor`: A code change that neither fixes a bug nor adds a feature.
- `perf`: A code change that improves simulation or rendering performance.
- `chore`: Maintenance tasks, dependency updates, build configuration.

#### Examples:
```bash
git commit -m "feat(cli): add router rip version 2 and passive-interface support"
git commit -m "fix(ospf): resolve DR election tie-break when priority is equal"
git commit -m "docs(api): update rate limit and JSON schema descriptions"
```

---

## 4. Architectural & Coding Standards

### Clean Separation of Concerns
1. **Engine Separation**: Networking logic (Spanning Tree, OSPF, route resolution, packet animation, CLI parsing) lives strictly inside `src/engine/` and must never import React components or DOM elements.
2. **Deterministic Simulation**: All algorithms (Dijkstra SPF, Spanning tree election, forwarding lookup) must produce deterministic, reproducible results given identical inputs.
3. **Immutability & Clones**: Use deep clone utilities (`src/utils/deepClone.ts`) or structural sharing when updating topology devices, interfaces, and routes.

### TypeScript Discipline
- Enable strict mode; do not introduce `any` types unless strictly necessary for polymorphic worker messages or third-party interop.
- Maintain comprehensive interfaces in `src/types/network.ts`.
- Ensure `npm run lint` passes with **0 errors**.

### UI & Styling Standards
- Use **Tailwind CSS v4** utility classes exclusively (`@import "tailwindcss";` in global CSS).
- Avoid inline `style={{ ... }}` attributes (exceptions: dynamic canvas panning/zooming transforms).
- Keep modal windows consistent with the established dark glassmorphism aesthetic (`bg-slate-900/90`, `border-slate-700`, `text-slate-100`).

---

## 5. Adding New Cisco IOS CLI Commands

To add or expand a CLI command:

1. **Check the Specification**:
   Verify the command syntax and expected behavior against the Cisco IOS 15.x command reference.
2. **Update the Command Trie / Registry**:
   Add command syntax, valid modes, and completion tokens to `src/engine/cli/commandTreeRegistry.ts` so autocompletion (`Tab`) and help (`?`) function properly.
3. **Implement Execution Logic**:
   Update `src/engine/cliEngine.ts` inside the appropriate mode handler (e.g., `handlePrivilegedExecCommand`, `handleInterfaceConfigCommand`, or `handleShowCommands`).
4. **Update Reference Guide**:
   Add the command's syntax, example, and description to `COMMAND_REFERENCE_LIST` in `src/components/CommandReferenceModal.tsx`.
5. **Add Automated Unit Tests**:
   Add test coverage in `src/engine/__tests__/cliEngine.test.ts` verifying valid execution, parameter errors, and output structure.

---

## 6. Testing Requirements

All contributions must pass the complete test suite before submission:

```bash
# 1. Run unit and property tests
npm test

# 2. Verify TypeScript static types
npm run lint

# 3. Verify production compilation
npm run build
```

When contributing to core simulation mechanics (STP, OSPF, routing), you are expected to add corresponding tests in `src/engine/__tests__/`. For algorithms with extensive state spaces, property-based tests using `fast-check` are strongly encouraged.

---

## 7. Pull Request Submission Checklist

Before opening a Pull Request (PR), verify that:

- [ ] You have created a dedicated branch off `main`.
- [ ] Your code compiles cleanly without any TypeScript errors (`npm run lint`).
- [ ] All existing and new tests pass (`npm test`).
- [ ] Production build succeeds without errors (`npm run build`).
- [ ] Commits adhere to Conventional Commits standards.
- [ ] Documentation has been updated to reflect any API or CLI behavior changes.
- [ ] The PR description clearly articulates the problem solved and testing performed.

Thank you for helping make WireCraft the world's most accessible, high-fidelity networking simulator!
