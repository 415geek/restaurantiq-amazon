# AI Rules for Development

## Tech Stack

- **Next.js 16.1.6** - React framework for server-side rendering, routing, and API routes
- **React 19.2.3** - UI library for building interactive user interfaces
- **TypeScript** - Type-safe JavaScript for better code quality and developer experience
- **Tailwind CSS 4** - Utility-first CSS framework for styling
- **Clerk** - Authentication and user management solution
- **React Hook Form + Zod** - Form handling and schema validation
- **Framer Motion** - Animation library for smooth UI transitions
- **Lucide React** - Icon library for consistent iconography
- **Sonner** - Toast notification system
- **clsx + tailwind-merge** - Utility functions for conditional className management

## Library Usage Rules

### Styling
- **ALWAYS** use Tailwind CSS for all styling needs
- Use `clsx` and `tailwind-merge` together for conditional className management (create a `cn()` utility function)
- Do NOT use inline styles or CSS modules unless absolutely necessary
- Follow Tailwind's utility-first approach for responsive design

### Icons
- **ALWAYS** use Lucide React for icons
- Import icons from `lucide-react` package
- Do NOT use other icon libraries or custom SVG icons unless Lucide doesn't have what you need

### Forms
- **ALWAYS** use React Hook Form for form state management
- **ALWAYS** use Zod for form validation schemas
- Use `@hookform/resolvers` to integrate Zod with React Hook Form
- Do NOT use uncontrolled forms or manual state management for forms

### Authentication
- **ALWAYS** use Clerk for authentication
- Use Clerk's hooks and components for login, signup, and protected routes
- Do NOT implement custom authentication logic

### Animations
- **ALWAYS** use Framer Motion for animations
- Use Framer Motion's `<motion>` components for smooth transitions
- Do NOT use CSS animations or other animation libraries

### Notifications
- **ALWAYS** use Sonner for toast notifications
- Use the `toast()` function from `sonner` for displaying notifications
- Do NOT use other notification libraries

### Routing
- **ALWAYS** use Next.js App Router (not Pages Router)
- Keep routes in `src/app/` directory following Next.js conventions
- Use Next.js `<Link>` component for navigation (not `<a>` tags)

### State Management
- Use React's built-in `useState`, `useReducer`, and `useContext` for local state
- For complex global state, consider using React Context or Zustand
- Do NOT use Redux unless absolutely necessary

### Data Fetching
- Use Next.js Server Components for data fetching when possible
- Use `fetch()` or native browser APIs for client-side data fetching
- Do NOT use Axios unless specifically required

### Type Safety
- **ALWAYS** use TypeScript for all new code
- Define proper interfaces and types for props, data structures, and API responses
- Do NOT use `any` type - use `unknown` or proper types instead
- Enable strict mode in TypeScript configuration

### Component Structure
- Keep components in `src/components/` directory
- Keep pages in `src/app/` directory (App Router)
- Create reusable, small, and focused components
- Use functional components with hooks (not class components)

### Code Quality
- Follow ESLint rules configured in the project
- Use meaningful variable and function names
- Write clean, readable, and maintainable code
- Add comments only when logic is not self-evident

### File Organization
- Keep all source code in `src/` folder
- Use clear and descriptive file names
- Group related files together in logical directories
- Use index files for cleaner imports when appropriate

## Development Workflow

1. **Understand** the requirements and existing codebase before making changes
2. **Plan** your approach, breaking down complex tasks into smaller steps
3. **Implement** changes following the rules above
4. **Verify** your changes work correctly and follow best practices
5. **Test** thoroughly before considering the task complete

## Prohibited Practices

- Do NOT use deprecated or unmaintained libraries
- Do NOT introduce security vulnerabilities (XSS, SQL injection, etc.)
- Do NOT hardcode sensitive data (API keys, secrets)
- Do NOT commit code with console.log statements (remove them before committing)
- Do NOT create unnecessary abstractions or over-engineer solutions
- Do NOT ignore TypeScript errors or warnings
- Do NOT use `any` type to bypass type checking