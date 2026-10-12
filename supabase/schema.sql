CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
  discord_id VARCHAR(30) PRIMARY KEY,
  riot_puuid VARCHAR(100) UNIQUE NOT NULL,
  riot_id VARCHAR(100) NOT NULL,
  summoner_id VARCHAR(100),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  pending_icon_id INT,
  active_skin VARCHAR(50) NOT NULL DEFAULT 'default',
  xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  coins INT NOT NULL DEFAULT 100 CHECK (coins >= 0),
  matches_played INT NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  matches_won INT NOT NULL DEFAULT 0 CHECK (matches_won >= 0 AND matches_won <= matches_played),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'em_andamento', 'finalizada')),
  captain_discord_id VARCHAR(30) REFERENCES players(discord_id),
  winner_team VARCHAR(10) CHECK (winner_team IN ('blue', 'red')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_players (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  discord_id VARCHAR(30) NOT NULL REFERENCES players(discord_id),
  team VARCHAR(10) NOT NULL CHECK (team IN ('blue', 'red')),
  assigned_card TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, discord_id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id BIGSERIAL PRIMARY KEY,
  discord_id VARCHAR(30) NOT NULL REFERENCES players(discord_id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('card_skin', 'role', 'title')),
  item_name VARCHAR(50) NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('card_skin', 'role', 'title')),
  price INT NOT NULL CHECK (price >= 0),
  preview_url TEXT,
  role_id VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Skins iniciais da loja
INSERT INTO shop_items (id, name, description, item_type, price, preview_url) VALUES
  ('default',  'Padrao',         'Skin padrao azul â€” gratis',                     'card_skin', 0,    NULL),
  ('shadow',   'Sombra Vermelha','Fundo escuro com aura vermelha intensa',          'card_skin', 500,  NULL),
  ('gold',     'Ouro',           'Fundo dourado para os mestres do ARAM',           'card_skin', 1000, NULL),
  ('void',     'O Vazio',        'Fundo roxo abissal de quem domina o Vazio',       'card_skin', 1500, NULL),
  ('ice',      'Freljord',       'Fundo gelado azul cristalino',                    'card_skin', 800,  NULL)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS match_players_match_id_idx ON match_players(match_id);
CREATE INDEX IF NOT EXISTS players_leaderboard_idx ON players(is_verified, level DESC, xp DESC);
