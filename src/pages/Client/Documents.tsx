import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  Description,
  PictureAsPdf,
  Image,
  VideoLibrary,
  AudioFile,
  InsertDriveFile,
  Download,
  Share,
  Visibility,
  CreateNewFolder,
  Upload,
  Search,
  FilterList,
  CloudUpload,
  FolderOpen,
  Assignment,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { documentsService } from '../../services/documentsService';
import {
  Document,
  DocumentCategory,
  DocumentFolder,
  DocumentType,
  SignatureStatus,
} from '../../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`documents-tabpanel-${index}`}
      aria-labelledby={`documents-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Documents: React.FC = () => {
  const { state } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | ''>('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');

  // Mock data for development
  const mockDocuments: Document[] = [
    {
      id: '1',
      patientId: state.user?.id || '',
      uploadedBy: 'therapist-1',
      category: DocumentCategory.TREATMENT_PLAN,
      type: DocumentType.PDF,
      title: 'Initial Treatment Plan',
      description: 'Comprehensive treatment plan for anxiety and depression therapy',
      fileName: 'treatment_plan_2024.pdf',
      fileSize: 2048000,
      mimeType: 'application/pdf',
      isEncrypted: true,
      isPatientVisible: true,
      requiresSignature: true,
      signatureStatus: SignatureStatus.PENDING,
      tags: ['therapy', 'treatment', 'initial'],
      metadata: {
        version: 1,
        checksum: 'abc123',
        originalFileName: 'treatment_plan_2024.pdf',
        pageCount: 8,
      },
      accessLog: [],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: '2',
      patientId: state.user?.id || '',
      uploadedBy: 'admin-1',
      category: DocumentCategory.CONSENT_FORM,
      type: DocumentType.PDF,
      title: 'Telehealth Consent Form',
      description: 'Consent for telehealth therapy sessions',
      fileName: 'telehealth_consent.pdf',
      fileSize: 512000,
      mimeType: 'application/pdf',
      isEncrypted: true,
      isPatientVisible: true,
      requiresSignature: true,
      signatureStatus: SignatureStatus.SIGNED,
      signedAt: new Date('2024-01-10'),
      signedBy: state.user?.id,
      tags: ['consent', 'telehealth'],
      metadata: {
        version: 1,
        checksum: 'def456',
        originalFileName: 'telehealth_consent.pdf',
        pageCount: 3,
      },
      accessLog: [],
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-10'),
    },
    {
      id: '3',
      patientId: state.user?.id || '',
      uploadedBy: 'therapist-1',
      category: DocumentCategory.PROGRESS_NOTE,
      type: DocumentType.PDF,
      title: 'Session 5 Progress Notes',
      description: 'Progress summary from fifth therapy session',
      fileName: 'session_5_notes.pdf',
      fileSize: 1024000,
      mimeType: 'application/pdf',
      isEncrypted: true,
      isPatientVisible: true,
      requiresSignature: false,
      tags: ['progress', 'session', 'notes'],
      metadata: {
        version: 1,
        checksum: 'ghi789',
        originalFileName: 'session_5_notes.pdf',
        pageCount: 2,
      },
      accessLog: [],
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-02-15'),
    },
    {
      id: '4',
      patientId: state.user?.id || '',
      uploadedBy: 'admin-1',
      category: DocumentCategory.EDUCATIONAL,
      type: DocumentType.PDF,
      title: 'Managing Anxiety Guide',
      description: 'Educational materials on anxiety management techniques',
      fileName: 'anxiety_guide.pdf',
      fileSize: 3072000,
      mimeType: 'application/pdf',
      isEncrypted: false,
      isPatientVisible: true,
      requiresSignature: false,
      tags: ['education', 'anxiety', 'self-help'],
      metadata: {
        version: 1,
        checksum: 'jkl012',
        originalFileName: 'anxiety_guide.pdf',
        pageCount: 12,
      },
      accessLog: [],
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-01-20'),
    },
  ];

  const mockFolders: DocumentFolder[] = [
    {
      id: '1',
      name: 'Treatment Plans',
      description: 'All treatment and care plans',
      patientId: state.user?.id || '',
      color: '#4CAF50',
      icon: 'assignment',
      documentCount: 1,
      isDefault: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      name: 'Consent Forms',
      description: 'Signed consent and authorization forms',
      patientId: state.user?.id || '',
      color: '#2196F3',
      icon: 'security',
      documentCount: 1,
      isDefault: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '3',
      name: 'Progress Notes',
      description: 'Session notes and progress reports',
      patientId: state.user?.id || '',
      color: '#FF9800',
      icon: 'schedule',
      documentCount: 1,
      isDefault: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  // Load documents and folders
  useEffect(() => {
    loadDocuments();
    loadFolders();
  }, [selectedCategory, selectedFolder]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // In a real app, this would call the API
      // const response = await documentsService.getPatientDocuments(
      //   state.user?.id,
      //   selectedCategory || undefined,
      //   selectedFolder || undefined
      // );
      
      // For now, use mock data
      let filteredDocs = mockDocuments;
      
      if (selectedCategory) {
        filteredDocs = filteredDocs.filter(doc => doc.category === selectedCategory);
      }
      
      if (searchQuery) {
        filteredDocs = filteredDocs.filter(doc => 
          doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      
      setDocuments(filteredDocs);
    } catch (error) {
      showError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      // In a real app: const response = await documentsService.getDocumentFolders(state.user?.id);
      setFolders(mockFolders);
    } catch (error) {
      console.error('Failed to load folders');
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const blob = await documentsService.downloadDocument(document.id);
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = document.fileName;
        a.click();
        window.URL.revokeObjectURL(url);
        showSuccess('Document downloaded successfully');
      } else {
        showError('Failed to download document');
      }
    } catch (error) {
      showError('Download failed');
    }
  };

  const getDocumentIcon = (type: DocumentType) => {
    switch (type) {
      case DocumentType.PDF:
        return <PictureAsPdf color="error" />;
      case DocumentType.IMAGE:
        return <Image color="primary" />;
      case DocumentType.VIDEO:
        return <VideoLibrary color="secondary" />;
      case DocumentType.AUDIO:
        return <AudioFile color="info" />;
      default:
        return <InsertDriveFile />;
    }
  };

  const getStatusChip = (document: Document) => {
    if (document.requiresSignature) {
      switch (document.signatureStatus) {
        case SignatureStatus.PENDING:
          return <Chip icon={<Warning />} label="Signature Required" color="warning" size="small" />;
        case SignatureStatus.SIGNED:
          return <Chip icon={<CheckCircle />} label="Signed" color="success" size="small" />;
        case SignatureStatus.DECLINED:
          return <Chip label="Declined" color="error" size="small" />;
        case SignatureStatus.EXPIRED:
          return <Chip label="Expired" color="default" size="small" />;
      }
    }
    return null;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getCategoryColor = (category: DocumentCategory) => {
    const colors: Record<DocumentCategory, string> = {
      [DocumentCategory.TREATMENT_PLAN]: '#4CAF50',
      [DocumentCategory.CONSENT_FORM]: '#2196F3',
      [DocumentCategory.PROGRESS_NOTE]: '#FF9800',
      [DocumentCategory.ASSESSMENT]: '#9C27B0',
      [DocumentCategory.EDUCATIONAL]: '#00BCD4',
      [DocumentCategory.INSURANCE]: '#795548',
      [DocumentCategory.INTAKE_FORM]: '#607D8B',
      [DocumentCategory.DISCHARGE_SUMMARY]: '#E91E63',
      [DocumentCategory.LAB_RESULT]: '#8BC34A',
      [DocumentCategory.PRESCRIPTION]: '#FF5722',
      [DocumentCategory.REFERRAL]: '#3F51B5',
      [DocumentCategory.LEGAL]: '#F44336',
      [DocumentCategory.OTHER]: '#9E9E9E',
    };
    return colors[category] || '#9E9E9E';
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          My Documents
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Access your treatment plans, forms, and medical records securely.
        </Typography>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                label="Category"
                onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
              >
                <MenuItem value="">All Categories</MenuItem>
                {Object.values(DocumentCategory).map((category) => (
                  <MenuItem key={category} value={category}>
                    {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('');
                setSelectedFolder(null);
              }}
            >
              Clear Filters
            </Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={() => setUploadDialogOpen(true)}
              fullWidth
            >
              Upload
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
        >
          <Tab icon={<Description />} label="All Documents" />
          <Tab icon={<FolderOpen />} label="Folders" />
          <Tab icon={<Assignment />} label="Pending Signatures" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2}>
            {documents.map((document) => (
              <Grid item xs={12} md={6} lg={4} key={document.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                      {getDocumentIcon(document.type)}
                      <Box sx={{ ml: 2, flex: 1 }}>
                        <Typography variant="h6" component="h3" sx={{ fontSize: '1rem' }}>
                          {document.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {document.description}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            label={document.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            size="small"
                            sx={{ 
                              bgcolor: getCategoryColor(document.category),
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                          {getStatusChip(document)}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(document.fileSize)} • {document.createdAt.toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                    
                    {document.tags.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        {document.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    )}
                  </CardContent>
                  
                  <CardActions>
                    <Tooltip title="View Document">
                      <IconButton size="small">
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownload(document)}>
                        <Download />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Share">
                      <IconButton size="small">
                        <Share />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={2}>
          {folders.map((folder) => (
            <Grid item xs={12} sm={6} md={4} key={folder.id}>
              <Card sx={{ cursor: 'pointer' }} onClick={() => setSelectedFolder(folder.id)}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: folder.color, mr: 2 }}>
                      <FolderOpen />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{folder.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {folder.documentCount} document{folder.documentCount !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </Box>
                  {folder.description && (
                    <Typography variant="body2" color="text.secondary">
                      {folder.description}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* Create New Folder Card */}
          <Grid item xs={12} sm={6} md={4}>
            <Card 
              sx={{ 
                cursor: 'pointer', 
                border: '2px dashed',
                borderColor: 'primary.main',
                bgcolor: 'rgba(25, 118, 210, 0.04)'
              }}
              onClick={() => setCreateFolderDialogOpen(true)}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <CreateNewFolder sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" color="primary">
                  Create New Folder
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <List>
          {documents
            .filter(doc => doc.requiresSignature && doc.signatureStatus === SignatureStatus.PENDING)
            .map((document) => (
              <React.Fragment key={document.id}>
                <ListItem>
                  <ListItemIcon>
                    {getDocumentIcon(document.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={document.title}
                    secondary={document.description}
                  />
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<Assignment />}
                  >
                    Sign Document
                  </Button>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          
          {documents.filter(doc => doc.requiresSignature && doc.signatureStatus === SignatureStatus.PENDING).length === 0 && (
            <Alert severity="info">
              No documents require your signature at this time.
            </Alert>
          )}
        </List>
      </TabPanel>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 4, border: '2px dashed #ccc', borderRadius: 2 }}>
            <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drag and drop files here
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              or click to browse
            </Typography>
            <Button variant="outlined" sx={{ mt: 2 }}>
              Choose Files
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Upload</Button>
        </DialogActions>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderDialogOpen} onClose={() => setCreateFolderDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            variant="outlined"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={folderDescription}
            onChange={(e) => setFolderDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              // Handle folder creation
              setCreateFolderDialogOpen(false);
              setFolderName('');
              setFolderDescription('');
              showSuccess('Folder created successfully');
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Documents;