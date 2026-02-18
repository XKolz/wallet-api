import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/user.entity';
import dataSource from '../data-source';

async function run() {
  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);

  const adminPhone = process.env.ADMIN_PHONE as string;
  const adminPassword = process.env.ADMIN_PASSWORD as string;
  const samplePhone = process.env.SAMPLE_USER_PHONE as string;
  const samplePassword = process.env.SAMPLE_USER_PASSWORD as string;

  const adminExists = await userRepository.findOne({ where: { phone: adminPhone } });
  if (!adminExists) {
    const admin = userRepository.create({
      phone: adminPhone,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: UserRole.ADMIN
    });
    await userRepository.save(admin);
  }

  const userExists = await userRepository.findOne({ where: { phone: samplePhone } });
  if (!userExists) {
    const user = userRepository.create({
      phone: samplePhone,
      passwordHash: await bcrypt.hash(samplePassword, 10),
      role: UserRole.USER
    });
    await userRepository.save(user);
  }

  await dataSource.destroy();
}

run()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Seed completed');
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  });
