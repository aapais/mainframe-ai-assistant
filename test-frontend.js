const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testFrontend() {
  console.log('🧪 Testing Frontend Data Flow\n');

  try {
    // Test API connection
    console.log('1️⃣ Testing API connection...');
    const response = await fetch(`${API_BASE}/incidents`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const incidents = await response.json();
    console.log(`   ✅ API responded with ${incidents.length} incidents\n`);

    // Display data as it would appear in the UI
    console.log('2️⃣ Data that would be displayed in the UI:\n');

    // Group by status as the UI does
    const grouped = {
      aberto: incidents.filter(i => i.status === 'aberto'),
      em_tratamento: incidents.filter(i => i.status === 'em_tratamento'),
      resolvido: incidents.filter(i => i.status === 'resolvido')
    };

    console.log('📋 Active Incidents (Problemas):');
    [...grouped.aberto, ...grouped.em_tratamento].forEach(inc => {
      console.log(`   • [${inc.severity.toUpperCase()}] ${inc.title}`);
      console.log(`     Status: ${inc.status} | Category: ${inc.category}`);
    });

    console.log('\n📚 Knowledge Base (Resolvidos):');
    grouped.resolvido.forEach(inc => {
      console.log(`   • ${inc.title}`);
      console.log(`     Solution: ${inc.solution ? inc.solution.substring(0, 50) + '...' : 'N/A'}`);
    });

    console.log('\n📊 Summary:');
    console.log(`   Active Problems: ${grouped.aberto.length + grouped.em_tratamento.length}`);
    console.log(`   Knowledge Articles: ${grouped.resolvido.length}`);
    console.log(`   Total: ${incidents.length}`);

    console.log('\n✅ Frontend data flow test successful!');
    console.log('   The React application should display all this data.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFrontend();