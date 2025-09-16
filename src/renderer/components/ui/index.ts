// Component Library Index
// Main entry point for all UI components

// Typography Components
export {
  Typography,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  Text,
  Small,
  Lead,
  Muted,
  Code,
  Kbd,
  Label,
  Caption,
  Link,
  Blockquote
} from './Typography';

export type { TypographyProps } from './Typography';

// Input Components
export {
  Input,
  Textarea
} from './Input';

export type { InputProps, TextareaProps } from './Input';

// Button Components
export {
  Button,
  IconButton,
  ButtonGroup,
  FAB,
  ToggleButton,
  CopyButton
} from './Button';

export type {
  ButtonProps,
  IconButtonProps,
  ButtonGroupProps,
  FABProps,
  ToggleButtonProps,
  CopyButtonProps
} from './Button';

// Layout Components
export {
  Container,
  Grid,
  GridItem,
  Flex,
  Stack,
  HStack,
  Center,
  Spacer,
  Box,
  Divider
} from './Layout';

export type {
  ContainerProps,
  GridProps,
  GridItemProps,
  FlexProps,
  StackProps,
  HStackProps,
  CenterProps,
  SpacerProps,
  BoxProps,
  DividerProps
} from './Layout';

// Card Components
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
  FeatureCard,
  KBEntryCard
} from './Card';

export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
  StatCardProps,
  FeatureCardProps,
  KBEntryCardProps
} from './Card';

// Data Display Components
export {
  Badge,
  Avatar,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  DataTable,
  List,
  ListItem,
  Progress
} from './DataDisplay';

export type {
  BadgeProps,
  AvatarProps,
  TableProps,
  DataTableProps,
  DataTableColumn,
  ListProps,
  ListItemProps,
  ProgressProps
} from './DataDisplay';

// Modal and Overlay Components
export {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
  Overlay,
  ConfirmModal,
  AlertModal
} from './Modal';

export type {
  ModalProps,
  ModalContentProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalDescriptionProps,
  ModalBodyProps,
  ModalFooterProps,
  ModalCloseProps,
  OverlayProps,
  ConfirmModalProps,
  AlertModalProps
} from './Modal';

// Navigation Components
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  Sidebar,
  SidebarNav,
  SidebarItem,
  SidebarGroup,
  Pagination
} from './Navigation';

export type {
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
  BreadcrumbProps,
  BreadcrumbListProps,
  BreadcrumbItemProps,
  BreadcrumbLinkProps,
  BreadcrumbPageProps,
  BreadcrumbSeparatorProps,
  BreadcrumbEllipsisProps,
  SidebarProps,
  SidebarNavProps,
  SidebarItemProps,
  SidebarGroupProps,
  PaginationProps
} from './Navigation';

// Utilities
export { cn, focusRing, transition } from '../../utils/className';

// Re-export commonly used types
export type {
  VariantProps
} from 'class-variance-authority';