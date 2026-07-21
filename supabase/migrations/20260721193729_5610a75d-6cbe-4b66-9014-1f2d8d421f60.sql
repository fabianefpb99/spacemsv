TRUNCATE TABLE cron.job_run_details;
SELECT cron.schedule('purge-cron-job-run-details', '0 3 * * *', $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days'$$);