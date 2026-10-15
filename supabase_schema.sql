-- ==============================================================================
-- STATIQWIN — Schemat bazy danych Supabase dla tabeli "profiles"
-- Wklej poniższy kod w panelu Supabase -> SQL Editor i kliknij "Run".
-- ==============================================================================

-- 1. Tworzenie tabeli profiles powiązanej z tabelą auth.users (relacja 1:1)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  is_pro BOOLEAN DEFAULT false,
  free_scans_used INTEGER DEFAULT 0,
  license_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Włączenie Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Polityki bezpieczeństwa RLS:
-- Użytkownik ma pełne prawo odczytu, wstawiania i edycji swojego własnego profilu
DROP POLICY IF EXISTS "Użytkownicy mogą odczytywać swój profil" ON public.profiles;
CREATE POLICY "Użytkownicy mogą odczytywać swój profil" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Użytkownicy mogą tworzyć swój profil" ON public.profiles;
CREATE POLICY "Użytkownicy mogą tworzyć swój profil" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Użytkownicy mogą aktualizować swój profil" ON public.profiles;
CREATE POLICY "Użytkownicy mogą aktualizować swój profil" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 4. Automatyczny trigger tworzący wiersz profilu zaraz po rejestracji w auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_pro, free_scans_used, license_key)
  VALUES (
    new.id,
    new.email,
    COALESCE((new.raw_user_meta_data->>'isPro')::boolean, false),
    COALESCE((new.raw_user_meta_data->>'freeScansUsed')::integer, 0),
    new.raw_user_meta_data->>'licenseKey'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
