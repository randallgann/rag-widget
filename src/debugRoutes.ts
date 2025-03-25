import app from './app';

// Helper function to extract base path from regexp
const getBasePath = (regexp: RegExp) => {
  const regexStr = regexp.toString();
  // Extract path from the regex pattern
  const match = regexStr.match(/\/\^\\\/([^\\]+)/);
  return match ? `/${match[1]}` : '';
};

// Helper function to print out all registered routes
const printRoutes = () => {
  const routes: any[] = [];
  
  // Get all registered routes
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Routes registered directly on the app
      routes.push({
        path: middleware.route.path,
        method: Object.keys(middleware.route.methods)[0].toUpperCase(),
      });
    } else if (middleware.name === 'router') {
      // Get the base path for this router
      const basePath = getBasePath(middleware.regexp);
      console.log(`Found router with base path: ${basePath}`);
      
      // Routes added via router
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          const fullPath = basePath + (handler.route.path === '/' ? '' : handler.route.path);
          routes.push({
            path: fullPath,
            method: Object.keys(handler.route.methods)[0].toUpperCase(),
          });
        }
      });
    }
  });

  console.log('=== REGISTERED ROUTES ===');
  routes.forEach(route => {
    console.log(`${route.method} ${route.path}`);
  });
  console.log('========================');

  // Specifically look for auth routes
  console.log('\n=== AUTH ROUTES ===');
  const authRoutes = routes.filter(route => route.path.includes('/api/auth'));
  if (authRoutes.length > 0) {
    authRoutes.forEach(route => {
      console.log(`${route.method} ${route.path}`);
    });
  } else {
    console.log('No auth routes found!');
  }
  console.log('===================');
};

// Print out all routes
printRoutes();