import { supabase } from '@/integrations/supabase/client';

// The Groq API key is a SERVER-side secret. The browser never sees it: every
// call is proxied through the `groq-proxy` Supabase edge function, which holds
// GROQ_API_KEY as a function secret. If the function isn't deployed/configured,
// each helper degrades gracefully to '' (AI features simply stay hidden).
const GROQ_PROXY_FUNCTION = 'groq-proxy';

interface GroqMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

async function callGroq(
    messages: GroqMessage[],
    maxTokens: number = 150
): Promise<string> {
    try {
        const { data, error } = await supabase.functions.invoke(GROQ_PROXY_FUNCTION, {
            body: { messages, maxTokens },
        });

        if (error) {
            console.warn('Groq proxy error:', error.message);
            return '';
        }

        return (typeof data?.content === 'string' ? data.content : '').trim();
    } catch (error) {
        console.warn('Groq proxy unavailable:', error);
        return '';
    }
}

// Feature 1: No-show risk explanation for admin
export async function explainNoShowRisk(
    riskLabel: 'low' | 'medium' | 'high',
    riskScore: number,
    specialty: string,
    appointmentType: string,
    appointmentTime: string,
    riskFactors: string[]
): Promise<string> {
    if (!riskFactors.length) return '';

    const messages: GroqMessage[] = [
        {
            role: 'system',
            content: 'You are a healthcare operations AI assistant for Indus Hospital & Health Network (IHHN) in Pakistan. Be concise, clinical, and practical. Never mention you are an AI model.'
        },
        {
            role: 'user',
            content: `Hospital OPD appointment analysis:
- No-show risk: ${riskLabel.toUpperCase()} (${Math.round(riskScore * 100)}% probability)
- Specialty: ${specialty}
- Type: ${appointmentType} consultation
- Time slot: ${appointmentTime}
- Risk factors identified: ${riskFactors.join('; ')}

In exactly 2 sentences: explain this risk to a hospital administrator and suggest one specific intervention to reduce the no-show probability.`
        }
    ];

    return callGroq(messages, 120);
}

// Feature 2: Smart scheduling suggestion when quota is near full
export async function getSchedulingSuggestion(
    doctorName: string,
    specialty: string,
    usedSlots: number,
    totalSlots: number,
    pendingRequests: number
): Promise<string> {
    const utilizationPct = Math.round((usedSlots / totalSlots) * 100);

    const messages: GroqMessage[] = [
        {
            role: 'system',
            content: 'You are a scheduling optimization assistant for Indus Hospital OPD. Give brief, actionable recommendations.'
        },
        {
            role: 'user',
            content: `Doctor scheduling status:
- Doctor: ${doctorName} (${specialty})
- Slots used: ${usedSlots}/${totalSlots} (${utilizationPct}% utilized)
- Pending appointment requests: ${pendingRequests}

Provide one short, specific scheduling recommendation in 1-2 sentences.`
        }
    ];

    return callGroq(messages, 100);
}

// Feature 3: Chief complaint summary for doctor before consultation
export async function summarizeChiefComplaint(
    chiefComplaint: string,
    patientAge?: number,
    specialty?: string
): Promise<string> {
    if (!chiefComplaint || chiefComplaint.trim().length < 5) return '';

    const messages: GroqMessage[] = [
        {
            role: 'system',
            content: 'You are a clinical documentation assistant for Indus Hospital doctors. Summarize patient complaints briefly and clinically. Never diagnose.'
        },
        {
            role: 'user',
            content: `Pre-consultation summary needed:
- Chief complaint: "${chiefComplaint}"
${patientAge ? `- Patient age: ${patientAge}` : ''}
${specialty ? `- Consulting specialty: ${specialty}` : ''}

Write a 1-sentence clinical pre-consultation note for the doctor.`
        }
    ];

    return callGroq(messages, 80);
}
