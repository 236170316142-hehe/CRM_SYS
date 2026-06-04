const axios = require('axios');

const dummyLeads = [
  { name: 'Alice Smith', email: 'alice@example.com', phone: '555-0101', company: 'Acme Corp', source: 'web' },
  { name: 'Bob Jones', email: 'bob@example.com', phone: '555-0102', company: 'Beta Inc', source: 'linkedin' },
  { name: 'Charlie Brown', email: 'charlie@example.com', phone: '555-0103', company: 'Gamma LLC', source: 'chat' },
  { name: 'Diana Prince', email: 'diana@example.com', phone: '555-0104', company: 'Delta Co', source: 'email' },
  { name: 'Evan Wright', email: 'evan@example.com', phone: '555-0105', company: 'Epsilon Ltd', source: 'web' },
];

async function runTest() {
  console.log('Starting webhook tests...');
  for (const lead of dummyLeads) {
    try {
      const response = await axios.post('http://localhost:5000/api/webhooks/lead', lead);
      console.log(`Successfully created lead: ${lead.name} - ID: ${response.data.leadId}`);
    } catch (error) {
      if (error.response) {
        console.error(`Failed to create lead ${lead.name}:`, error.response.status, error.response.data);
      } else {
        console.error(`Failed to create lead ${lead.name}:`, error.message);
      }
    }
  }
  console.log('Finished testing 5 dummy leads.');
}

runTest();
