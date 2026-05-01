-- ─────────────────────────────────────────────────────────────────────────────
-- Propietarios Airbnb KAI — Test data seed
-- Run in Supabase Dashboard → SQL Editor.
--
-- What it does:
--   1. Clears all operational data (listings, incidents, notifications, logs)
--      while KEEPING app_users, app_config, and email_templates intact.
--   2. Creates 2 approved listings per user in app_users.
--      Apt numbers are assigned sequentially on floor 7 (701, 702, 703 …).
--      Even-indexed users get a named operator; every 3rd listing gets an
--      Airbnb link to exercise the full listing display.
--   3. Opens one incident per listing, reported by a DIFFERENT user (rotating
--      reporter so reporter ≠ listing owner). All 7 incident types are used in
--      rotation: noise · damage · rules · payment · unauthorized · cleanliness · other.
--      Categories rotate: serious · minor · watch · serious · watch · minor · minor.
--
-- Requires: at least 1 user in app_users (sign in once first).
-- With 1 user the incidents are self-reported (no other user to rotate to).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Wipe operational data, keep users / config / templates ────────────────
DELETE FROM public.audit_logs;
DELETE FROM public.listing_audit_events;
DELETE FROM public.email_delivery_logs;
DELETE FROM public.notifications;
DELETE FROM public.incidents;
DELETE FROM public.listings;

-- ── 2. Generate listings + incidents via PL/pgSQL ────────────────────────────
DO $$
DECLARE
  -- User arrays (populated below)
  uids    TEXT[]  := '{}';
  unames  TEXT[]  := '{}';
  emails  TEXT[]  := '{}';
  was     TEXT[]  := '{}';
  n       INTEGER := 0;

  -- Loop variables
  r_user    RECORD;
  r_listing RECORD;
  i         INTEGER;
  owner_pos INTEGER;
  rep_pos   INTEGER;
  type_idx  INTEGER := 0;
  apt1      TEXT;
  apt2      TEXT;
  lid1      TEXT;
  lid2      TEXT;

  -- ── Incident templates — 7 entries, one per type ─────────────────────────
  inc_types TEXT[] := ARRAY[
    'noise', 'damage', 'rules', 'payment',
    'unauthorized', 'cleanliness', 'other'
  ];
  inc_cats TEXT[] := ARRAY[
    'serious', 'minor', 'watch', 'serious', 'watch', 'minor', 'minor'
  ];
  inc_descs TEXT[] := ARRAY[
    -- 1 · noise / serious
    'Los huéspedes estuvieron generando ruido extremo desde las 10pm hasta pasadas las 2am con música electrónica a alto volumen desde el balcón y gritos en los pasillos. Tres vecinos del mismo piso llamaron a la portería; seguridad del edificio intervino en dos ocasiones sin resultado. Al tercer aviso se solicitó llamar a la policía. El operador fue notificado pero no respondió.',

    -- 2 · damage / minor
    'Al realizar la inspección post check-out se encontraron los siguientes daños: el espaldar de la silla principal del comedor está partido en dos, hay una mancha oscura no removible en el tapete de la sala (aparentemente vino tinto), y el mando a distancia del aire acondicionado está partido. Se tomaron fotografías de cada daño y se subieron al caso en Airbnb.',

    -- 3 · rules / watch
    'Durante la estadía se detectó olor fuerte a cigarrillo en el balcón y en la habitación principal, lo cual incumple la norma expresa de no fumado dentro y en áreas comunes del apartamento. El operador llamó al huésped para informar la política; el huésped prometió no repetirlo pero al día siguiente el olor persistía. Se requiere acción formal del propietario.',

    -- 4 · payment / serious
    'Airbnb envió notificación de disputa de pago iniciada por el huésped por un monto de USD 380. El huésped alega que el apartamento no corresponde con las fotos y descripciones publicadas, y solicita reembolso completo de las 5 noches. La disputa vence en 48 horas. Se requiere respuesta urgente con documentación fotográfica actualizada del apartamento.',

    -- 5 · unauthorized / watch
    'Se confirmó la presencia de 6 personas adicionales que pernoctaron en el apartamento sin estar registradas en la reserva. La reserva indicaba máximo 4 huéspedes para 2 personas. Varios vecinos reportaron ruido y movimiento inusual durante la madrugada. El operador solicitó presencia solo del titular de la reserva, sin resultado. El caso está documentado con cámaras de pasillo.',

    -- 6 · cleanliness / minor
    'El apartamento fue recibido en malas condiciones de limpieza al finalizar la estadía: cocina con residuos de comida en la estufa y mesón, baño principal con toallas sucias en el piso, ropa de cama con manchas visibles y varias bolsas de basura sin sacar. Se contrató un servicio de limpieza profunda adicional con costo de $120.000 COP que no estaba previsto.',

    -- 7 · other / minor
    'El huésped reportó al check-out que perdió la llave electrónica del apartamento durante su estadía. La reposición de la llave y reprogramación del sistema generó un costo de $180.000 COP. El huésped acepta responsabilidad pero solicita dividir el costo al 50%. El propietario debe confirmar si acepta el acuerdo o procede con el cargo completo vía Airbnb.'
  ];
  inc_guests TEXT[] := ARRAY[
    'Carlos Andrés Mendoza Vargas',
    'Valentina García Ruiz',
    'Luis Felipe Pérez Salcedo',
    'María José Rodríguez',
    'Andrés Felipe López Castro',
    'Sofía Martínez Torres',
    'Diego Alejandro Ramírez'
  ];
  inc_cities TEXT[] := ARRAY[
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla',
    'Bucaramanga', 'Manizales', 'Pereira'
  ];
  -- Days ago each incident was created (staggered across last 5 weeks)
  inc_days_ago INTEGER[] := ARRAY[35, 28, 21, 14, 10, 6, 2];

BEGIN
  -- ── Load all users into arrays, ordered consistently ──────────────────────
  FOR r_user IN
    SELECT uid, name, email, whatsapp
    FROM public.app_users
    ORDER BY email
  LOOP
    n      := n + 1;
    uids   := array_append(uids,   r_user.uid);
    unames := array_append(unames, r_user.name);
    emails := array_append(emails, r_user.email);
    was    := array_append(was,    r_user.whatsapp);
  END LOOP;

  IF n = 0 THEN
    RAISE EXCEPTION 'No users found in app_users. Sign in at least once to create an account, then re-run this script.';
  END IF;

  IF n = 1 THEN
    RAISE NOTICE 'Only 1 user found — incidents will be self-reported because no other user exists.';
  END IF;

  -- ── Create 2 approved listings per user ───────────────────────────────────
  -- Apt numbers: 701 & 702 for user 1, 703 & 704 for user 2, etc.
  -- All on floor 7 to keep it simple (floor = apt div 100 = 7).
  FOR i IN 1..n LOOP
    apt1 := lpad((700 + (i - 1) * 2 + 1)::text, 3, '0');  -- e.g. 701
    apt2 := lpad((700 + (i - 1) * 2 + 2)::text, 3, '0');  -- e.g. 702
    lid1 := gen_random_uuid()::text;
    lid2 := gen_random_uuid()::text;

    INSERT INTO public.listings (
      id, owner_uid, owner, user_email,
      status, reviewed_by_uid, reviewed_by_name, reviewed_at,
      apt, tower, rooms, guests,
      operator, operator_email, operator_whatsapp,
      contact, email, airbnb,
      created_at
    ) VALUES
    -- First listing: 2 bedrooms, 4 guests, no operator
    (
      lid1,
      uids[i], unames[i], emails[i],
      'approved', 'system', 'Test Data Script', now() - make_interval(days => 60),
      apt1, 'KAI', '2', 4,
      '', '', '',
      was[i], emails[i], '',
      now() - make_interval(days => 60)
    ),
    -- Second listing: 3 bedrooms, 6 guests; even users have an operator
    (
      lid2,
      uids[i], unames[i], emails[i],
      'approved', 'system', 'Test Data Script', now() - make_interval(days => 45),
      apt2, 'KAI', '3', 6,
      CASE WHEN i % 2 = 0 THEN 'KAI Luxury Rentals' ELSE '' END,
      CASE WHEN i % 2 = 0 THEN 'reservas@kailuxury.co' ELSE '' END,
      CASE WHEN i % 2 = 0 THEN '+573104567890' ELSE '' END,
      was[i], emails[i],
      -- Every 3rd listing gets an Airbnb link
      CASE WHEN i % 3 = 1
        THEN 'https://www.airbnb.com/rooms/kai-morros-' || apt2
        ELSE ''
      END,
      now() - make_interval(days => 45)
    );
  END LOOP;

  -- ── Create one incident per listing ───────────────────────────────────────
  -- Reporter rotates: for a listing owned by user at position P,
  -- reporter = user at position (P mod N) + 1 (next user, wraps around).
  FOR r_listing IN
    SELECT id AS lid, apt, owner_uid
    FROM public.listings
    WHERE status = 'approved'
    ORDER BY apt
  LOOP
    type_idx := type_idx + 1;

    -- Resolve owner's 1-based position in the arrays
    owner_pos := 1;
    FOR i IN 1..n LOOP
      IF uids[i] = r_listing.owner_uid THEN
        owner_pos := i;
        EXIT;
      END IF;
    END LOOP;

    -- Next user in rotation (wraps: last user → first user)
    IF n = 1 THEN
      rep_pos := 1;   -- self-report when only one user exists
    ELSE
      rep_pos := (owner_pos % n) + 1;
    END IF;

    -- Pick template (1-based, cycling through 7)
    i := ((type_idx - 1) % 7) + 1;

    INSERT INTO public.incidents (
      id,
      reporter_uid, reporter_name,
      apt_id, apt_label,
      guest_name, guest_city, guest_country,
      incident_date,
      type, category, description,
      status, sla_hours,
      next_sla_reminder_at,
      created_at
    ) VALUES (
      gen_random_uuid()::text,
      uids[rep_pos], unames[rep_pos],
      r_listing.lid, 'Apto ' || r_listing.apt,
      inc_guests[i],
      inc_cities[i],
      'Colombia',
      current_date - make_interval(days => inc_days_ago[i]),
      inc_types[i],
      inc_cats[i],
      inc_descs[i],
      'open',
      24,
      now() + make_interval(hours => 24),
      now() - make_interval(days => inc_days_ago[i])
    );
  END LOOP;

  RAISE NOTICE '✅ Test data seeded — users: %, listings: %, incidents: %',
    n, n * 2,
    (SELECT count(*) FROM public.incidents);
END $$;

-- ── 3. Verification ──────────────────────────────────────────────────────────
SELECT
  'app_users (kept)'   AS "table", count(*)::int AS rows FROM public.app_users
UNION ALL
SELECT 'listings',                  count(*)::int        FROM public.listings
UNION ALL
SELECT 'incidents',                 count(*)::int        FROM public.incidents
UNION ALL
SELECT 'notifications',             count(*)::int        FROM public.notifications
UNION ALL
SELECT 'audit_logs',                count(*)::int        FROM public.audit_logs
ORDER BY "table";

COMMIT;
