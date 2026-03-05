import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Popover,
  Paper,
  ListItemButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard,
  People,
  Event,
  Message,
  Receipt,
  Settings,
  ExitToApp,
  Notifications,
  Menu as MenuIcon,
  VideoCall,
  AttachMoney,
  Circle,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

const drawerWidth = 240;

export const Layout: React.FC = () => {
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = React.useState<null | HTMLElement>(null);
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    const userRole = state.user?.role as string;
    if (userRole === 'patient' || userRole === 'client') {
      navigate('/client/settings');
    } else if (userRole === 'therapist') {
      navigate('/therapist/profile');
    } else if (userRole === 'staff') {
      navigate('/staff/profile');
    } else if (userRole === 'admin') {
      navigate('/admin/settings');
    }
  };

  const handleSettingsClick = () => {
    handleMenuClose();
    const userRole = state.user?.role as string;
    if (userRole === 'patient' || userRole === 'client') {
      navigate('/client/settings');
    } else if (userRole === 'therapist') {
      navigate('/therapist/settings');
    } else if (userRole === 'staff') {
      navigate('/staff/settings');
    } else if (userRole === 'admin') {
      navigate('/admin/settings');
    }
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
    if (!loading && notifications.length === 0) {
      void fetchNotifications();
    }
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleNotificationItemClick = async (notificationId: string, relatedObjectId?: string) => {
    await markAsRead(notificationId);
    handleNotificationClose();
    
    // Navigate to messages if it's a message notification
    if (relatedObjectId) {
      navigate('/messages');
    }
  };

  // Navigation items based on user role
  const getNavigationItems = () => {
    const items = [];

    // Check user role and show appropriate navigation
    // Note: Backend sends string roles, not enum values
    const userRole = state.user?.role as string;

    if (userRole === 'patient' || userRole === 'client') {
      // Patient/Client navigation - core features they need
      items.push(
        { text: 'My Dashboard', icon: <Dashboard />, path: '/client' },
        { text: 'My Appointments', icon: <Event />, path: '/appointments' },
        { text: 'Messages', icon: <Message />, path: '/messages' },
        { text: 'Telehealth', icon: <VideoCall />, path: '/telehealth/dashboard' },
        { text: 'My Documents', icon: <Receipt />, path: '/client/documents' },
        { text: 'Billing', icon: <AttachMoney />, path: '/client/billing' },
      );
    } else if (userRole === 'therapist') {
      // Therapist navigation
      items.push(
        { text: 'Dashboard', icon: <Dashboard />, path: '/therapist' },
        { text: 'My Patients', icon: <People />, path: '/therapist/patients' },
        { text: 'Appointments', icon: <Event />, path: '/appointments' },
        { text: 'SOAP Notes', icon: <Settings />, path: '/therapist/soap-notes' },
        { text: 'Messages', icon: <Message />, path: '/messages' },
        { text: 'Telehealth', icon: <VideoCall />, path: '/telehealth/dashboard' },
      );
    } else {
      // Admin/default navigation (shows all features)
      items.push(
        { text: 'Admin Dashboard', icon: <Dashboard />, path: '/admin' },
        { text: 'Patient Management', icon: <People />, path: '/admin/patients' },
        { text: 'Appointments', icon: <Event />, path: '/appointments' },
        { text: 'SOAP Notes', icon: <Receipt />, path: '/admin/soap-notes' },
        { text: 'Messages', icon: <Message />, path: '/messages' },
        { text: 'Telehealth', icon: <VideoCall />, path: '/telehealth/dashboard' },
        { text: 'Billing', icon: <AttachMoney />, path: '/admin/billing' },
        { text: 'Reports', icon: <Settings />, path: '/admin/reports' },
      );
    }

    // Original role-based logic (commented out during bypass):
    /*
    if (hasRole(UserRole.ADMIN)) {
      items.push(
        { text: 'Admin Dashboard', icon: <Dashboard />, path: '/admin' },
        { text: 'User Management', icon: <People />, path: '/admin/users' },
        { text: 'Billing Overview', icon: <Receipt />, path: '/admin/billing' },
        { text: 'System Reports', icon: <Settings />, path: '/admin/reports' },
      );
    }

    if (hasRole([UserRole.THERAPIST, UserRole.STAFF])) {
      items.push(
        { text: 'Dashboard', icon: <Dashboard />, path: '/therapist' },
        { text: 'Patients', icon: <People />, path: '/therapist/patients' },
        { text: 'Appointments', icon: <Event />, path: '/therapist/appointments' },
        { text: 'SOAP Notes', icon: <Receipt />, path: '/therapist/soap-notes' },
        { text: 'Messages', icon: <Message />, path: '/therapist/messages' },
      );
    }

    if (hasRole(UserRole.CLIENT)) {
      items.push(
        { text: 'My Dashboard', icon: <Dashboard />, path: '/client' },
        { text: 'My Appointments', icon: <Event />, path: '/client/appointments' },
        { text: 'Messages', icon: <Message />, path: '/client/messages' },
        { text: 'Documents', icon: <Receipt />, path: '/client/documents' },
      );
    }
    */

    return items;
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" color="primary">
          SafeHaven EHR
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {getNavigationItems().map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => {
                navigate(item.path);
                if (isMobile) {
                  setMobileOpen(false);
                }
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            {isMobile ? 'SafeHaven' : 'SafeHaven EHR System'}
          </Typography>

          {/* Notifications */}
          <IconButton color="inherit" sx={{ mr: { xs: 1, sm: 2 } }} onClick={handleNotificationClick}>
            <Badge badgeContent={unreadCount} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          {/* Notification Popover */}
          <Popover
            open={Boolean(notificationAnchor)}
            anchorEl={notificationAnchor}
            onClose={handleNotificationClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <Paper sx={{ width: { xs: 320, sm: 360 }, maxHeight: 400 }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Notifications</Typography>
                {unreadCount > 0 && (
                  <Button size="small" onClick={() => void markAllAsRead()}>
                    Mark all read
                  </Button>
                )}
              </Box>
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {loading ? (
                  <ListItem>
                    <ListItemText primary="Loading..." />
                  </ListItem>
                ) : notifications.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="No notifications" secondary="You're all caught up!" />
                  </ListItem>
                ) : (
                  notifications.map((notification) => (
                    <ListItemButton
                      key={notification.id}
                      onClick={() => void handleNotificationItemClick(notification.id, notification.related_object_id)}
                      sx={{
                        backgroundColor: notification.is_read ? 'transparent' : 'action.hover',
                        '&:hover': {
                          backgroundColor: 'action.selected',
                        },
                      }}
                    >
                      <ListItemIcon>
                        {!notification.is_read && (
                          <Circle sx={{ fontSize: 10, color: 'primary.main' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={notification.title}
                        secondary={notification.message}
                        primaryTypographyProps={{ fontWeight: notification.is_read ? 'normal' : 'bold' }}
                      />
                    </ListItemButton>
                  ))
                )}
              </List>
            </Paper>
          </Popover>

          {/* User Menu */}
          <Button
            onClick={handleProfileMenuOpen}
            color="inherit"
            startIcon={
              <Avatar sx={{ width: 32, height: 32 }}>
                {state.user?.firstName?.charAt(0)}
              </Avatar>
            }
            sx={{ minWidth: isMobile ? 0 : 'auto', px: isMobile ? 1 : 2 }}
          >
            {!isMobile ? `${state.user?.firstName} ${state.user?.lastName}` : ''}
          </Button>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleProfileClick}>Profile</MenuItem>
            <MenuItem onClick={handleSettingsClick}>Settings</MenuItem>
            <Divider />
            <MenuItem onClick={() => handleLogout()}>
              <ExitToApp sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: Math.min(drawerWidth, 280) },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};