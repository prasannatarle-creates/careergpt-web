// Streaming Chat Module
// Enable real-time response delivery using Server-Sent Events (SSE)

import { NextResponse } from 'next/server';

async function handleChatSendStream(request, callMultiModel, callSingleModel, getOpenAIClient, getModelStr, callModel) {
  // Stream multi-model responses in real-time
  // This uses Server-Sent Events (SSE) for real-time data pushing
  
  try {
    const body = await request.json();
    const { sessionId, message, activeModels, ALL_MODELS } = body;
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Use encoder for SSE format
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send connection established
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`));

          // Stream setup
          const CAREER_SYSTEM = `You are CareerGPT, an expert AI career guidance counselor. Help students and job seekers with career paths, skills, interviews, and job search strategies. Be specific, actionable, and encouraging. Use markdown formatting.

FACTUAL ACCURACY: Only recommend REAL platforms, certifications, and resources. Do NOT invent fake URLs, companies, or statistics. If uncertain about specific data, say "approximately" or "based on industry estimates".`;

          const recentMsgs = []; // Would be populated from session history
          const fullMessages = [
            { role: 'system', content: CAREER_SYSTEM },
            ...recentMsgs,
            { role: 'user', content: message }
          ];

          const client = getOpenAIClient();
          const modelsToUse = activeModels 
            ? ALL_MODELS.filter(m => activeModels.includes(m.name))
            : ALL_MODELS;

          // Stream each model's response
          const responses = [];
          let modelIndex = 0;

          for (const model of modelsToUse) {
            modelIndex++;
            const modelStr = getModelStr(model.provider, model.model);

            // Send model start event
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ 
                type: 'model_start', 
                model: model.name, 
                modelIndex,
                color: model.color
              })}\n\n`
            ));

            const start = Date.now();
            let modelResponse = '';

            try {
              // Stream response from this specific model
              const response = await client.chat.completions.create({
                model: modelStr,
                messages: fullMessages,
                stream: true,
                temperature: 0.7,
              });

              // Stream chunks as they arrive
              for await (const chunk of response) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                  modelResponse += content;
                  
                  // Send chunk to client
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ 
                      type: 'model_chunk', 
                      model: model.name,
                      chunk: content
                    })}\n\n`
                  ));
                }
              }

              responses.push({
                name: model.name,
                color: model.color,
                response: modelResponse,
                duration: Date.now() - start,
                success: true
              });

              // Send model complete event
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'model_complete', 
                  model: model.name,
                  duration: Date.now() - start,
                  tokenCount: modelResponse.length / 4 // Rough estimate
                })}\n\n`
              ));

            } catch (modelError) {
              console.error(`Model ${model.name} error:`, modelError.message);
              responses.push({
                name: model.name,
                color: model.color,
                response: null,
                error: modelError.message,
                success: false
              });

              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'model_error', 
                  model: model.name,
                  error: modelError.message
                })}\n\n`
              ));
            }
          }

          // Synthesize responses
          const validResponses = responses.filter(r => r.success && r.response);
          
          if (validResponses.length > 1) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'synthesis_start' })}\n\n`
            ));

            const synthPrompt = `Combine these expert career advice responses:\n\n${validResponses.map(r => `--- ${r.name} ---\n${r.response}`).join('\n\n')}\n\nProvide one unified markdown response.`;
            
            let synthesized = '';
            try {
              const synthResponse = await client.chat.completions.create({
                model: getModelStr('openai', 'gpt-4.1'),
                messages: [
                  { role: 'system', content: 'Synthesize multiple AI responses into one cohesive career advice response.' },
                  { role: 'user', content: synthPrompt }
                ],
                stream: true
              });

              for await (const chunk of synthResponse) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                  synthesized += content;
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ 
                      type: 'synthesis_chunk', 
                      chunk: content
                    })}\n\n`
                  ));
                }
              }

              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'synthesis_complete',
                  tokenCount: synthesized.length / 4
                })}\n\n`
              ));
            } catch (synthError) {
              console.warn('Synthesis error:', synthError.message);
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'synthesis_error',
                  error: synthError.message
                })}\n\n`
              ));
            }
          }

          // Final completion
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ 
              type: 'done',
              totalModels: modelsToUse.length,
              successCount: validResponses.length,
              timestamp: new Date().toISOString()
            })}\n\n`
          ));

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
          ));
          controller.close();
        }
      },
      cancel() {
        console.log('Stream cancelled by client');
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('Chat stream error:', error.message);
    return NextResponse.json({ error: 'Stream failed: ' + error.message }, { status: 500 });
  }
}

// Client-side event listener helper (for frontend)
const clientStreamHelper = `
// Usage in React:
async function* streamChat(message, activeModels) {
  const response = await fetch('/api/chat/send-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, activeModels })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n\\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6));
        yield event;
      }
    }
  }
}

// Usage:
const stream = streamChat('Tell me about cloud careers');
for await (const event of stream) {
  if (event.type === 'model_chunk') {
    // Append chunk to UI for model
    updateModelResponse(event.model, event.chunk);
  } else if (event.type === 'synthesis_chunk') {
    // Append to synthesized response
    updateSynthesized(event.chunk);
  } else if (event.type === 'done') {
    // All done
    console.log('Chat complete');
  }
}
`;

module.exports = {
  handleChatSendStream,
  clientStreamHelper
};
