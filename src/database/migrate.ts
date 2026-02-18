import dataSource from './data-source';

async function run() {
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}

run()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Migrations completed');
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  });
