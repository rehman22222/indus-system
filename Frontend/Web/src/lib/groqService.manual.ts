import { explainNoShowRisk, getSchedulingSuggestion, summarizeChiefComplaint } from './groqService';

// Manual verification function — call this once from browser console
// by importing and running verifyGroqIntegration()
export async function verifyGroqIntegration(): Promise<void> {
    console.log('🔍 Testing Groq API integration...');

    try {
        // Test 1: No-show explanation
        console.log('Test 1: No-show risk explanation');
        const explanation = await explainNoShowRisk(
            'high',
            0.72,
            'Dermatology',
            'physical',
            '08:00',
            ['Booked more than 2 weeks in advance', 'High-risk appointment time slot']
        );
        console.log(explanation ? '✅ Test 1 PASSED — ' + explanation : '❌ Test 1 FAILED — No response from Groq');

        // Test 2: Scheduling suggestion
        console.log('Test 2: Scheduling suggestion');
        const suggestion = await getSchedulingSuggestion(
            'Dr. Sarah Ahmed',
            'Cardiology',
            26,
            30,
            5
        );
        console.log(suggestion ? '✅ Test 2 PASSED — ' + suggestion : '❌ Test 2 FAILED — No response from Groq');

        // Test 3: Chief complaint summary
        console.log('Test 3: Chief complaint summary');
        const summary = await summarizeChiefComplaint(
            'Patient has had persistent chest pain and shortness of breath for 3 days',
            45,
            'Cardiology'
        );
        console.log(summary ? '✅ Test 3 PASSED — ' + summary : '❌ Test 3 FAILED — No response from Groq');

        console.log('🏁 Groq integration verification complete.');
    } catch (error) {
        console.error('❌ Groq integration verification failed:', error);
    }
}
