# OpenAI Integration - UI Preview

## 🎨 Admin Integrations Page

### Page Header
```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  Integration Hub                                [📊 View Analytics]║
║  Configure API keys and third-party service integrations         ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Information Banner
```
╔═══════════════════════════════════════════════════════════════════╗
║ ℹ️  Secure Storage                                                ║
║                                                                   ║
║ All API keys are encrypted and stored securely. Only            ║
║ administrators can view and manage integrations.                 ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Tabs
```
╔═══════════════════════════════════════════════════════════════════╗
║  [AI Providers]  Communication  Storage                          ║
╚═══════════════════════════════════════════════════════════════════╝
```

## 🤖 OpenAI Integration Card

### Before Configuration (No API Key)
```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  ┌────┐                                                           ║
║  │ 🧠 │  OpenAI                         [Not Configured]          ║
║  └────┘  AI models and embeddings                                ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  OpenAI API Key                                                  ║
║  ┌─────────────────────────────────────────────┐  [👁️]          ║
║  │ sk-proj-...                                  │                ║
║  └─────────────────────────────────────────────┘                ║
║  Get your API key from OpenAI Platform 🔗                        ║
║                                                                   ║
║  ℹ️  Your API key is encrypted and stored securely. It will be   ║
║  used for AI chat, embeddings, and meeting summaries.            ║
║                                                                   ║
║  [💾 Save API Key]                                               ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### After Configuration (With Valid API Key)
```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  ┌────┐                                                           ║
║  │ 🧠 │  OpenAI              [✓ Valid]           [⚫─────○] Enabled║
║  └────┘  AI models and embeddings                                ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  Current API Key                                                 ║
║  ┌─────────────────────────────────────┐                        ║
║  │ sk-...xyz4                           │  [Update]  [🗑️]         ║
║  └─────────────────────────────────────┘                        ║
║  Last validated: 2 hours ago                                     ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  [✓ Test Connection]                                             ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  ℹ️  Active Features: AI Chat Assistant, Semantic Search,        ║
║  Meeting Summaries, Document Embeddings                          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### During Update (Edit Mode)
```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  ┌────┐                                                           ║
║  │ 🧠 │  OpenAI              [✓ Valid]           [⚫─────○] Enabled║
║  └────┘  AI models and embeddings                                ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  OpenAI API Key                                                  ║
║  ┌─────────────────────────────────────────────┐  [👁️]          ║
║  │ sk-proj-new-key-here...                      │                ║
║  └─────────────────────────────────────────────┘                ║
║  Get your API key from OpenAI Platform 🔗                        ║
║                                                                   ║
║  ℹ️  Your API key is encrypted and stored securely. It will be   ║
║  used for AI chat, embeddings, and meeting summaries.            ║
║                                                                   ║
║  [💾 Save API Key]  [Cancel]                                     ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### With Validation Error
```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  ┌────┐                                                           ║
║  │ 🧠 │  OpenAI              [✗ Invalid]         [⚫─────○] Enabled║
║  └────┘  AI models and embeddings                                ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  Current API Key                                                 ║
║  ┌─────────────────────────────────────┐                        ║
║  │ sk-...xyz4                           │  [Update]  [🗑️]         ║
║  └─────────────────────────────────────┘                        ║
║  Last validated: 5 minutes ago                                   ║
║                                                                   ║
║  🔴 Invalid API key or insufficient permissions                   ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  [✓ Test Connection]                                             ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### When Disabled
```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  ┌────┐                                                           ║
║  │ 🧠 │  OpenAI              [Disabled]          [○─────⚫] Disabled║
║  └────┘  AI models and embeddings                                ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  Current API Key                                                 ║
║  ┌─────────────────────────────────────┐                        ║
║  │ sk-...xyz4                           │  [Update]  [🗑️]         ║
║  └─────────────────────────────────────┘                        ║
║  Last validated: 1 day ago                                       ║
║                                                                   ║
║  ─────────────────────────────────────────────────────────────── ║
║                                                                   ║
║  [✓ Test Connection]                                             ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

## 🎨 Status Badges

### Status Indicators
```
[✓ Valid]        - Green badge, API key tested successfully
[✗ Invalid]      - Red badge, API key failed validation
[Not Tested]     - Gray badge, key not validated yet
[⚠️ Error]       - Red badge, validation error occurred
[Disabled]       - Gray badge, integration turned off
[Not Configured] - Outline badge, no key added yet
```

### Toggle States
```
[⚫─────○] Enabled   - Toggle on (dark circle on right)
[○─────⚫] Disabled  - Toggle off (dark circle on left)
```

## 🖱️ Interactive Elements

### Buttons
```
[💾 Save API Key]     - Primary button, saves the API key
[Update]              - Secondary button, enters edit mode
[Cancel]              - Secondary button, cancels editing
[✓ Test Connection]   - Outline button, validates API key
[🗑️]                  - Icon button, deletes integration (with confirmation)
[👁️]                  - Icon button, toggles password visibility
[📊 View Analytics]   - Outline button, navigates to analytics
```

### Input Fields
```
┌─────────────────────────────────────────────┐  [👁️]
│ sk-proj-...                                  │
└─────────────────────────────────────────────┘
Type: password (toggleable)
Placeholder: "sk-proj-..."
Font: Monospace
```

## 📱 Responsive Design

### Desktop (Wide Screen)
```
╔════════════════════════════════════════════════════════════╗
║  [OpenAI Card]              [Anthropic Card (future)]      ║
║                                                            ║
║  [Google AI Card (future)]  [Perplexity Card (future)]    ║
╚════════════════════════════════════════════════════════════╝
Grid: 2 columns
```

### Tablet (Medium Screen)
```
╔═══════════════════════════════╗
║  [OpenAI Card]                ║
║                               ║
║  [Anthropic Card (future)]    ║
╚═══════════════════════════════╝
Grid: 1 column
```

### Mobile (Small Screen)
```
╔════════════════════╗
║  [OpenAI Card]     ║
║                    ║
║  [Anthropic Card]  ║
╚════════════════════╝
Grid: 1 column, full width
```

## 🎨 Color Scheme

### Status Colors
```
✓ Valid       → Green (#10b981)
✗ Invalid     → Red (#ef4444)
⚠️ Error      → Red (#ef4444)
Not Tested    → Gray (#6b7280)
Disabled      → Gray (#9ca3af)
Not Configured→ Gray outline
```

### UI Elements
```
Primary Button    → Blue (#3b82f6)
Secondary Button  → Gray outline
Destructive       → Red (#ef4444)
Success Toast     → Green (#10b981)
Error Toast       → Red (#ef4444)
Info Alert        → Blue (#3b82f6)
Warning Alert     → Orange (#f59e0b)
```

### Dark Mode Support
```
All components support dark mode:
- Automatically adjusts colors
- High contrast maintained
- Icon colors adapt
- Card backgrounds darken
```

## 🔔 Notifications (Toasts)

### Success
```
┌─────────────────────────────────────┐
│ ✓ Success                           │
│ API key saved successfully          │
└─────────────────────────────────────┘
Position: Top right
Duration: 3 seconds
Color: Green
```

### Error
```
┌─────────────────────────────────────┐
│ ✗ Error                             │
│ Failed to save API key              │
└─────────────────────────────────────┘
Position: Top right
Duration: 5 seconds
Color: Red
```

### Validation Success
```
┌─────────────────────────────────────┐
│ ✓ Success                           │
│ API key is valid                    │
└─────────────────────────────────────┘
```

### Validation Error
```
┌─────────────────────────────────────┐
│ ✗ Validation Failed                 │
│ Invalid API key                     │
└─────────────────────────────────────┘
```

## 🗑️ Delete Confirmation Dialog

```
╔═══════════════════════════════════════════════════════════╗
║  Remove OpenAI Integration                                ║
║                                                           ║
║  Are you sure you want to remove the OpenAI API key?     ║
║  This will disable all AI features.                       ║
║                                                           ║
║                                      [Cancel]  [Remove]   ║
╚═══════════════════════════════════════════════════════════╝
Overlay: Dark backdrop (80% opacity)
Animation: Fade in
Actions: Cancel (gray), Remove (red)
```

## 🔍 Loading States

### Card Loading
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                     ⏳ Loading...                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
Shows spinner while fetching data
```

### Button Loading
```
[⏳ Saving...]      - Disabled with spinner
[⏳ Testing...]     - Disabled with spinner
[⏳ Validating...]  - Disabled with spinner
```

## 📊 Future Enhancements Preview

### Coming Soon - Additional Providers
```
╔═══════════════════════════════════════════════════════════╗
║  [AI Providers]  Communication  Storage                   ║
╚═══════════════════════════════════════════════════════════╝

╔════════════════════════════╗  ╔════════════════════════════╗
║ 🧠 OpenAI                  ║  ║ 🤖 Anthropic               ║
║ [✓ Valid] [Enabled]        ║  ║ [Not Configured]           ║
╚════════════════════════════╝  ╚════════════════════════════╝

╔════════════════════════════╗  ╔════════════════════════════╗
║ 🔍 Google AI               ║  ║ 🌐 Perplexity              ║
║ [Not Configured]           ║  ║ [Not Configured]           ║
╚════════════════════════════╝  ╚════════════════════════════╝
```

---

**UI Framework**: React + TypeScript + shadcn/ui  
**Styling**: Tailwind CSS  
**Icons**: Lucide React  
**Components**: Radix UI (Accessible)  
**Responsive**: Mobile-first design  
**Theme**: Light & Dark mode support  
**Animations**: Smooth transitions  
**Status**: Production Ready ✅
