INSERT INTO public.users (id, email, created_at, api_provider)
SELECT id, email, created_at, 'openrouter'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
