import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.12.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY não configurada');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          webhookSecret
        );
      } catch (err: any) {
        console.error('Erro ao verificar assinatura do webhook:', err.message);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      event = JSON.parse(body);
    }

    console.log('Stripe Webhook recebido:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const { error } = await supabase
          .from('transactions')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('provider_transaction_id', paymentIntent.id);

        if (error) {
          console.error('Erro ao atualizar transação:', error);
        } else {
          console.log('Transação marcada como paga:', paymentIntent.id);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const { error } = await supabase
          .from('transactions')
          .update({
            status: 'failed',
          })
          .eq('provider_transaction_id', paymentIntent.id);

        if (error) {
          console.error('Erro ao atualizar transação:', error);
        } else {
          console.log('Transação marcada como falha:', paymentIntent.id);
        }
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const { error } = await supabase
          .from('transactions')
          .update({
            status: 'cancelled',
          })
          .eq('provider_transaction_id', paymentIntent.id);

        if (error) {
          console.error('Erro ao atualizar transação:', error);
        } else {
          console.log('Transação cancelada:', paymentIntent.id);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        
        const { error } = await supabase
          .from('transactions')
          .update({
            status: 'refunded',
            refunded_at: new Date().toISOString(),
          })
          .eq('provider_transaction_id', charge.payment_intent);

        if (error) {
          console.error('Erro ao atualizar transação:', error);
        } else {
          console.log('Transação reembolsada:', charge.payment_intent);
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        
        const { error } = await supabase
          .from('transactions')
          .update({
            status: 'chargeback',
          })
          .eq('provider_transaction_id', dispute.payment_intent);

        if (error) {
          console.error('Erro ao atualizar transação:', error);
        } else {
          console.log('Chargeback criado:', dispute.payment_intent);
        }
        break;
      }

      default:
        console.log('Evento não tratado:', event.type);
    }

    await supabase
      .from('activity_logs')
      .insert({
        action: 'stripe_webhook',
        resource_type: 'webhook',
        details: {
          event_type: event.type,
          event_id: event.id,
        },
      });

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Erro ao processar webhook Stripe:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erro ao processar webhook',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});