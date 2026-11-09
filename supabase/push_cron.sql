-- Push notifications, STEP 3 of 3: the hourly schedule. Run it ONLY after push.sql has been run and the `send-push` function is deployed.
-- Every hour at :05 the database calls the function; the function decides (per student, in the student's own time zone) whether anything should be sent.
-- The Authorization header carries the project's public anon key (it only lets the call reach the function); the real check is the shared secret that
-- lives in public.push_config and is read here inside the database, so nobody has to copy it anywhere.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'send-push-hourly';

select cron.schedule(
  'send-push-hourly',
  '5 * * * *',
  $cron$
    select net.http_post(
      url     := 'https://leqbcbtlltvinizbkiya.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcWJjYnRsbHR2aW5pemJraXlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTAzMzMsImV4cCI6MjA5NDgyNjMzM30.8YX3gte7d6voWCqkZAuV9BR-mAmat9ObvmTffFt3NOo',
        'x-cron-secret', (select cron_secret from public.push_config where id)
      ),
      body    := '{}'::jsonb
    );
  $cron$
);
