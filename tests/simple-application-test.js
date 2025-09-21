const http = require('http');
const fs = require('fs');
const path = require('path');

async function testApplicationEndpoint() {
  console.log('🚀 Starting Simple Application Test...\n');

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5173,
      path: '/',
      method: 'GET',
      timeout: 10000
    }, (res) => {
      console.log(`✅ Response Status: ${res.statusCode}`);
      console.log(`📊 Response Headers:`, res.headers);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📄 Response Size: ${data.length} bytes`);

        // Analyze the HTML content
        const hasSettingsButton = data.includes('Settings') || data.includes('settings');
        const hasModal = data.includes('modal') || data.includes('dialog');
        const hasReact = data.includes('React') || data.includes('react');
        const hasVite = data.includes('Vite') || data.includes('vite');

        console.log('\n🔍 Content Analysis:');
        console.log(`- Contains "Settings": ${hasSettingsButton ? '✅ YES' : '❌ NO'}`);
        console.log(`- Contains "modal/dialog": ${hasModal ? '✅ YES' : '❌ NO'}`);
        console.log(`- React application: ${hasReact ? '✅ YES' : '❌ NO'}`);
        console.log(`- Vite development: ${hasVite ? '✅ YES' : '❌ NO'}`);

        // Save the HTML content for inspection
        const htmlPath = '/mnt/c/mainframe-ai-assistant/tests/application-response.html';
        fs.writeFileSync(htmlPath, data);
        console.log(`💾 HTML content saved to: ${htmlPath}`);

        // Extract title if present
        const titleMatch = data.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
          console.log(`📄 Page Title: "${titleMatch[1]}"`);
        }

        console.log('\n📋 TEST RESULTS:');
        console.log('=' .repeat(40));
        console.log(`✅ Application Status: ${res.statusCode === 200 ? 'RUNNING' : 'ERROR'}`);
        console.log(`📊 Content Type: ${res.headers['content-type'] || 'Unknown'}`);
        console.log(`🔍 Settings Reference: ${hasSettingsButton ? 'FOUND' : 'NOT FOUND'}`);

        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'],
          hasSettings: hasSettingsButton,
          hasModal: hasModal,
          contentLength: data.length
        });
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request failed:', err.message);

      if (err.code === 'ECONNREFUSED') {
        console.log('\n💡 DIAGNOSIS: Application is not running on localhost:5173');
        console.log('   Try starting the application with: npm run dev');
      }

      reject(err);
    });

    req.on('timeout', () => {
      console.error('❌ Request timed out');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Additional function to check if dev server is running
async function checkDevServer() {
  console.log('🔍 Checking if development server is running...\n');

  try {
    const result = await testApplicationEndpoint();

    if (result.status === 200) {
      console.log('\n🎉 SUCCESS: Application is running and accessible!');

      if (result.hasSettings) {
        console.log('✅ Settings functionality appears to be present in the application');
      } else {
        console.log('⚠️  Settings functionality not immediately visible in HTML');
        console.log('   This might be dynamically loaded by JavaScript');
      }

      return true;
    } else {
      console.log(`\n⚠️  Application responded with status: ${result.status}`);
      return false;
    }

  } catch (error) {
    console.log('\n❌ Application is not accessible at http://localhost:5173');
    console.log('   Please ensure the development server is running with: npm run dev');
    return false;
  }
}

// Manual testing instructions
function printManualTestingInstructions() {
  console.log('\n📋 MANUAL TESTING INSTRUCTIONS:');
  console.log('=' .repeat(50));
  console.log('1. Ensure the application is running: npm run dev');
  console.log('2. Open browser and navigate to: http://localhost:5173');
  console.log('3. Look for a Settings button on the page');
  console.log('4. Click the Settings button');
  console.log('5. Verify the Settings Modal opens with:');
  console.log('   ✅ Sidebar with navigation categories');
  console.log('   ✅ Breadcrumb navigation');
  console.log('   ✅ Search bar');
  console.log('   ✅ Footer with Save/Cancel buttons');
  console.log('6. Take screenshots for documentation');
  console.log('\n🎯 Expected Enhanced Features:');
  console.log('- Organized sidebar navigation');
  console.log('- Clear breadcrumb trail');
  console.log('- Functional search capability');
  console.log('- Proper footer with action buttons');
}

// Run the test
async function runTests() {
  try {
    const isRunning = await checkDevServer();

    if (!isRunning) {
      printManualTestingInstructions();
    }

  } catch (error) {
    console.error('Test execution failed:', error.message);
    printManualTestingInstructions();
  }
}

runTests();