# UI Component Hierarchy Diagram
## Mainframe KB Assistant - Visual Architecture Map

```mermaid
graph TD
    %% Application Root
    App[Application Root]

    %% State Providers
    App --> SP[State Providers Layer]
    SP --> ASP[AppStateProvider]
    SP --> KSP[KBStateProvider]
    SP --> USP[UIStateProvider]
    SP --> NSP[NotificationProvider]

    %% Main Layout
    SP --> ML[MainWindowLayout]

    %% Window Components
    ML --> WTB[WindowTitleBar]
    ML --> WSB[WindowStatusBar]
    ML --> WR[WindowResizer]

    %% Tab System
    WTB --> WT[WindowTabs]
    WT --> DT[Dashboard Tab]
    WT --> KT[Knowledge Base Tab]
    WT --> ST[Search Tab]

    %% Main Content Areas
    ML --> MCA[Main Content Area]
    MCA --> DV[Dashboard View]
    MCA --> KBV[Knowledge Base View]
    MCA --> SV[Search View]

    %% Dashboard View Components
    DV --> MC1[Metrics Card - Usage Stats]
    DV --> MC2[Metrics Card - Recent Activity]
    DV --> MC3[Metrics Card - Top Categories]
    DV --> QA[Quick Actions Panel]

    %% Knowledge Base View Components
    KBV --> EL[Entry List Panel]
    KBV --> DP[Details Panel]
    KBV --> AP[Actions Panel]

    EL --> ELH[Entry List Header]
    EL --> ELF[Entry List Filters]
    EL --> VRL[Virtualized Results List]

    VRL --> ER1[Entry Row 1]
    VRL --> ER2[Entry Row 2]
    VRL --> ERN[Entry Row N...]

    ER1 --> EC[Entry Card]
    EC --> ET[Entry Title]
    EC --> ES[Entry Summary]
    EC --> EB[Entry Badges]
    EC --> EM[Entry Metadata]

    DP --> EDH[Entry Details Header]
    DP --> EDD[Entry Details Description]
    DP --> EDS[Entry Details Solution]
    DP --> EDM[Entry Details Metadata]
    DP --> RB[Rating Buttons]

    %% Search View Components
    SV --> SB[Search Bar]
    SV --> FC[Filter Controls]
    SV --> RL[Results List]
    SV --> NR[No Results State]

    SB --> SI[Search Input]
    SB --> SS[Search Suggestions]
    SB --> SC[Search Controls]

    FC --> CF[Category Filter]
    FC --> TF[Tag Filter]
    FC --> DF[Date Filter]
    FC --> SF[Sort Filter]

    RL --> SR1[Search Result 1]
    RL --> SR2[Search Result 2]
    RL --> SRN[Search Result N...]

    SR1 --> SRC[Search Result Card]
    SRC --> SRT[Result Title with Highlighting]
    SRC --> SRS[Result Summary]
    SRC --> SRB[Result Badges]
    SRC --> SRM[Result Metadata]
    SRC --> CSI[Confidence Score Indicator]

    %% Action Panel Components
    AP --> NAB[New Entry Button]
    AP --> EB[Edit Button]
    AP --> DB[Delete Button]
    AP --> ExpB[Export Button]

    %% Modal System
    ML --> MS[Modal Stack]
    MS --> NEF[New Entry Form Modal]
    MS --> EEF[Edit Entry Form Modal]
    MS --> CD[Confirm Dialog]
    MS --> HM[Help Modal]

    %% Form Components
    NEF --> KBF[KB Entry Form]
    KBF --> TF1[Title Field]
    KBF --> PF[Problem Field]
    KBF --> SF[Solution Field]
    KBF --> CatF[Category Field]
    KBF --> TagF[Tags Field]
    KBF --> FA[Form Actions]

    FA --> SBtn[Save Button]
    FA --> CBtn[Cancel Button]

    %% Notification System
    App --> NS[Notification System]
    NS --> NT1[Toast Notification 1]
    NS --> NT2[Toast Notification 2]
    NS --> NTN[Toast Notification N...]

    %% Keyboard Shortcuts
    App --> KS[Keyboard Shortcut Handler]
    KS --> GSH[Global Shortcuts]
    KS --> NSH[Navigation Shortcuts]
    KS --> ASH[Action Shortcuts]

    %% Error Boundary
    App --> EBD[Error Boundary]
    EBD --> ES[Error State UI]
    EBD --> RT[Retry Component]

    %% Loading States
    App --> LS[Loading System]
    LS --> SL[Skeleton Loader]
    LS --> SP[Spinner]
    LS --> PB[Progress Bar]

    %% Accessibility Layer
    App --> A11Y[Accessibility Manager]
    A11Y --> SR[Screen Reader Announcements]
    A11Y --> FT[Focus Trap]
    A11Y --> LR[Live Region]

    %% Styling Classes
    classDef provider fill:#e1f5fe
    classDef layout fill:#f3e5f5
    classDef view fill:#e8f5e8
    classDef component fill:#fff3e0
    classDef atom fill:#fce4ec
    classDef system fill:#f1f8e9

    class ASP,KSP,USP,NSP provider
    class ML,WTB,WSB,WR layout
    class DV,KBV,SV view
    class MC1,MC2,MC3,EL,DP,AP,SB,FC,RL component
    class TF1,PF,SF,CatF,TagF,SBtn,CBtn,SI,ET,ES atom
    class NS,KS,EBD,LS,A11Y system
```

## State Flow Diagram

```mermaid
graph LR
    %% User Actions
    UA[User Actions] --> KBH[KB Hooks]
    UA --> UIH[UI Hooks]
    UA --> SH[Search Hooks]

    %% Hook Layer
    KBH --> KBC[KB Context]
    UIH --> UIC[UI Context]
    SH --> SC[Search Context]

    %% Context Layer
    KBC --> LS[Local Storage]
    KBC --> DB[SQLite Database]
    KBC --> API[Gemini API - Optional]

    UIC --> WS[Window State]
    UIC --> TH[Theme State]
    UIC --> NS[Notification State]

    SC --> IDX[Search Index]
    SC --> FTS[Full Text Search]
    SC --> AIE[AI Enhancement]

    %% State Updates
    LS --> UC[UI Components]
    DB --> UC
    API --> UC
    WS --> UC
    TH --> UC
    NS --> UC
    IDX --> UC
    FTS --> UC
    AIE --> UC

    %% Component Re-render
    UC --> VL[Virtual List]
    UC --> SR[Search Results]
    UC --> DF[Detail Forms]
    UC --> MT[Metrics]

    %% Styling
    classDef action fill:#ffebee
    classDef hook fill:#e3f2fd
    classDef context fill:#f1f8e9
    classDef storage fill:#fff8e1
    classDef component fill:#f3e5f5

    class UA action
    class KBH,UIH,SH hook
    class KBC,UIC,SC context
    class LS,DB,API,WS,TH,NS,IDX,FTS,AIE storage
    class UC,VL,SR,DF,MT component
```

## Performance Optimization Flow

```mermaid
graph TD
    %% Input Layer
    UI[User Input] --> D[Debounce 300ms]

    %% Search Process
    D --> L1[Level 1: Local Search]
    L1 --> L1R[< 100ms Response]
    L1R --> UR[Update Results]

    %% AI Enhancement (Optional)
    L1R --> AICheck{AI Available?}
    AICheck -->|Yes| L2[Level 2: AI Enhancement]
    AICheck -->|No| UR

    L2 --> L2R[< 2s Response]
    L2R --> MR[Merge Results]
    MR --> UR

    %% Result Processing
    UR --> VM[Virtual Memo Check]
    VM --> VL[Virtual List Render]
    VL --> UI

    %% Caching Layer
    L1 --> C1[Local Cache]
    L2 --> C2[AI Cache]
    C1 --> L1R
    C2 --> L2R

    %% Error Handling
    L2 --> EH{Error?}
    EH -->|Yes| FB[Fallback to Local]
    EH -->|No| MR
    FB --> UR

    %% Performance Monitoring
    L1R --> PM[Performance Monitor]
    L2R --> PM
    PM --> AM[Analytics]

    %% Styling
    classDef input fill:#e8f5e8
    classDef process fill:#e1f5fe
    classDef cache fill:#fff3e0
    classDef error fill:#ffebee
    classDef monitor fill:#f3e5f5

    class UI,D input
    class L1,L2,VM,VL process
    class C1,C2 cache
    class EH,FB error
    class PM,AM monitor
```

## Component Communication Patterns

```mermaid
sequenceDiagram
    participant U as User
    participant SB as SearchBar
    participant SH as useKBSearch Hook
    participant DB as SQLite Database
    participant AI as Gemini API
    participant RL as ResultsList
    participant DP as DetailsPanel

    %% Search Flow
    U->>SB: Types search query
    SB->>SH: Debounced search call
    SH->>DB: Local search query
    DB-->>SH: Local results (< 100ms)
    SH->>RL: Update with local results

    %% AI Enhancement (Optional)
    SH->>AI: Enhance results (if online)
    AI-->>SH: Enhanced results (< 2s)
    SH->>RL: Update with enhanced results

    %% Selection Flow
    U->>RL: Clicks on result
    RL->>SH: Select result
    SH->>DP: Show entry details
    DP->>DB: Load full entry data
    DB-->>DP: Entry details
    DP->>U: Display solution

    %% Rating Flow
    U->>DP: Rates solution
    DP->>SH: Record rating
    SH->>DB: Update entry metrics
    DB-->>SH: Confirmation
    SH->>DP: Update UI state
```

## Keyboard Navigation Map

```mermaid
graph TD
    %% Global Level
    GS[Global Shortcuts] --> OS[Open Search - Ctrl+F]
    GS --> NT[New Tab - Ctrl+T]
    GS --> NE[New Entry - Ctrl+N]
    GS --> H[Help - F1]

    %% Search Context
    SC[Search Context] --> TAB[Tab - Next Result]
    SC --> STAB[Shift+Tab - Previous Result]
    SC --> ENT[Enter - Select Result]
    SC --> ESC[Escape - Clear Search]
    SC --> AF[Arrow Keys - Navigate Filters]

    %% Result List Context
    RC[Result List Context] --> UD[Up/Down Arrows - Navigate]
    RC --> HOME[Home - First Result]
    RC --> END[End - Last Result]
    RC --> CENT[Ctrl+Enter - Open in New Window]
    RC --> SP[Space - Preview]

    %% Detail Context
    DC[Detail Context] --> R[R - Rate Solution]
    DC --> E[E - Edit Entry]
    DC --> C[C - Copy Solution]
    DC --> P[P - Print]

    %% Form Context
    FC[Form Context] --> CS[Ctrl+S - Save]
    FC --> CESC[Ctrl+Escape - Cancel]
    FC --> CTAB[Ctrl+Tab - Next Field]
    FC --> CSTAB[Ctrl+Shift+Tab - Previous Field]

    %% Quick Filters
    QF[Quick Filters] --> A1[Alt+1 - JCL]
    QF --> A2[Alt+2 - VSAM]
    QF --> A3[Alt+3 - DB2]
    QF --> A4[Alt+4 - Batch]
    QF --> A5[Alt+5 - Functional]
```

This comprehensive component hierarchy and flow diagrams provide a clear visual representation of the UI architecture, showing how components interact, how state flows through the system, and how users navigate through the interface efficiently.