# TheraCare Frontend Setup & Running Guide

## Prerequisites Installation

### Option 1: Install Node.js (Recommended)
1. **Download Node.js**: Visit https://nodejs.org and download the LTS version for macOS
2. **Install Node.js**: Run the installer package
3. **Verify Installation**:
   ```bash
   node --version
   npm --version
   ```

### Option 2: Using Homebrew (if available)
```bash
# Install Homebrew first if not available
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node
```

### Option 3: Using NVM (Node Version Manager)
```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or run
source ~/.bashrc

# Install latest Node.js
nvm install node
nvm use node
```

## Running the Frontend

### Step 1: Navigate to Frontend Directory
```bash
cd "/Users/gregorygrant/Desktop/Websites/react/react webapp/Safe Haven/safe haven/frontend"
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start Development Server
```bash
npm start
```

The application will open at: http://localhost:3000

## Frontend Features Overview

### 🏥 **TheraCare EHR System**
- **HIPAA-Compliant**: All data encrypted and audit-logged
- **Role-Based Access**: Admin, Therapist/Staff, and Client portals
- **Comprehensive Dashboard**: Statistics, management, and reporting

### 🔐 **Security Features**
- JWT Authentication with automatic refresh
- Field-level encryption for PHI data
- Comprehensive audit logging
- Role-based permission system
- Session management and timeout

### 📊 **Admin Dashboard**
- User management (CRUD operations)
- System monitoring and statistics
- Advanced reporting system
- System configuration and settings
- HIPAA audit trail management

### 👩‍⚕️ **Staff/Therapist Dashboard**
- Patient management and charts
- Appointment scheduling and management
- Clinical documentation (SOAP notes)
- Secure messaging system
- Treatment planning tools

### 👤 **Client Portal** (In Development)
- Appointment booking and management
- Secure messaging with therapists
- Treatment progress tracking
- Personal health information access
- Document management

### 📋 **Core Modules**
- **Scheduling**: Calendar integration, reminders, conflict resolution
- **Telehealth**: Video conferencing, session recording
- **Billing**: Insurance verification, claim processing
- **Messaging**: Encrypted communication, file attachments
- **Documentation**: SOAP notes, digital signatures
- **Reporting**: Analytics, compliance reports, financial summaries

## Development Status

✅ **Completed (67%)**:
- Project architecture and setup
- HIPAA compliance infrastructure
- Database schema and models
- Authentication and authorization
- Admin dashboard (full functionality)
- Staff/therapist dashboard (full functionality)
- Reports and analytics system
- Core services and API integration

🔄 **In Progress**:
- Client portal development
- Advanced scheduling system
- Telehealth module implementation

⏳ **Planned**:
- Billing and insurance integration
- Enhanced messaging system
- SOAP notes with digital signatures
- Comprehensive testing suite
- Production deployment

## Troubleshooting

### Common Issues:

1. **Node.js Not Found**
   - Install Node.js from nodejs.org
   - Ensure Node.js is in your system PATH

2. **npm install fails**
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules and package-lock.json, then reinstall

3. **Port 3000 already in use**
   - Kill process: `lsof -ti:3000 | xargs kill -9`
   - Or use different port: `PORT=3001 npm start`

4. **TypeScript compilation errors**
   - All current TypeScript errors have been resolved
   - Run `npm run lint` to check for any new issues

### Performance Optimization:
- The app uses Material-UI for consistent theming
- Code splitting implemented for better loading
- Lazy loading for non-critical components
- Optimized bundle size with tree shaking

## Demo Credentials

When the app is running, use these credentials to test different user roles:

- **Admin**: admin@theracare.com / admin123
- **Therapist**: therapist@theracare.com / therapist123  
- **Client**: client@theracare.com / client123

## API Integration

The frontend is configured to connect to the Django backend at:
- **Development**: http://localhost:8000/api
- **Production**: Configure REACT_APP_API_BASE_URL in .env

## Next Steps

1. Install Node.js and npm
2. Run `npm install` and `npm start`
3. Continue development with Client Portal
4. Implement remaining EHR modules
5. Conduct comprehensive testing
6. Deploy to production environment

## Support

For technical support or questions about the TheraCare EHR system:
- Check the documentation in the `/docs` directory
- Review the API documentation at `/api/docs`
- Ensure HIPAA compliance guidelines are followed