/**
 * Test Data Factory for User Objects
 */

const { faker } = require('@faker-js/faker');

class UserFactory {
  static create(overrides = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      username: faker.internet.userName(),
      avatar: faker.image.avatar(),
      isActive: true,
      isVerified: true,
      roles: ['user'],
      permissions: ['read'],
      provider: 'local',
      providerId: null,
      lastLogin: faker.date.recent(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  static createMany(count = 5, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createAdmin(overrides = {}) {
    return this.create({
      roles: ['admin', 'user'],
      permissions: ['read', 'write', 'delete', 'admin'],
      ...overrides,
    });
  }

  static createOAuthUser(provider = 'google', overrides = {}) {
    const providers = {
      google: {
        providerId: faker.string.alphanumeric(21),
        email: faker.internet.email(),
        avatar: `https://lh3.googleusercontent.com/a/${faker.string.alphanumeric(20)}`,
      },
      microsoft: {
        providerId: faker.string.uuid(),
        email: faker.internet.email(),
        avatar: `https://graph.microsoft.com/v1.0/users/${faker.string.uuid()}/photo/$value`,
      },
      okta: {
        providerId: faker.string.alphanumeric(20),
        email: faker.internet.email(),
        avatar: faker.image.avatar(),
      },
    };

    return this.create({
      provider,
      ...providers[provider],
      ...overrides,
    });
  }

  static createSAMLUser(overrides = {}) {
    return this.create({
      provider: 'saml',
      providerId: faker.string.alphanumeric(15),
      email: faker.internet.email(),
      groups: ['employees', 'developers'],
      department: faker.commerce.department(),
      ...overrides,
    });
  }

  static createInactiveUser(overrides = {}) {
    return this.create({
      isActive: false,
      lastLogin: faker.date.past({ years: 1 }),
      ...overrides,
    });
  }

  static createUnverifiedUser(overrides = {}) {
    return this.create({
      isVerified: false,
      verificationToken: faker.string.uuid(),
      verificationExpires: faker.date.future(),
      ...overrides,
    });
  }

  static createPasswordResetUser(overrides = {}) {
    return this.create({
      resetPasswordToken: faker.string.uuid(),
      resetPasswordExpires: faker.date.future(),
      ...overrides,
    });
  }

  static createBulkUsers(count = 100) {
    const users = [];
    const providers = ['google', 'microsoft', 'okta', 'saml', 'local'];

    for (let i = 0; i < count; i++) {
      const provider = faker.helpers.arrayElement(providers);

      if (provider === 'local') {
        users.push(this.create());
      } else if (provider === 'saml') {
        users.push(this.createSAMLUser());
      } else {
        users.push(this.createOAuthUser(provider));
      }

      // Add some special cases
      if (i % 20 === 0) users.push(this.createAdmin());
      if (i % 30 === 0) users.push(this.createInactiveUser());
      if (i % 40 === 0) users.push(this.createUnverifiedUser());
    }

    return users;
  }
}

class SessionFactory {
  static create(userId = null, overrides = {}) {
    return {
      id: faker.string.uuid(),
      userId: userId || faker.string.uuid(),
      token: faker.string.alphanumeric(64),
      refreshToken: faker.string.alphanumeric(64),
      expiresAt: faker.date.future(),
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent(),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      isActive: true,
      ...overrides,
    };
  }

  static createExpired(userId = null, overrides = {}) {
    return this.create(userId, {
      expiresAt: faker.date.past(),
      isActive: false,
      ...overrides,
    });
  }

  static createMultiple(userId, count = 3) {
    return Array.from({ length: count }, () => this.create(userId));
  }
}

class AuthEventFactory {
  static create(userId = null, overrides = {}) {
    const eventTypes = [
      'login',
      'logout',
      'password_change',
      'email_change',
      'role_change',
      'failed_login',
    ];

    return {
      id: faker.string.uuid(),
      userId: userId || faker.string.uuid(),
      eventType: faker.helpers.arrayElement(eventTypes),
      timestamp: faker.date.recent(),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      success: true,
      metadata: {},
      ...overrides,
    };
  }

  static createFailedLogin(userId = null, overrides = {}) {
    return this.create(userId, {
      eventType: 'failed_login',
      success: false,
      metadata: {
        reason: 'invalid_credentials',
        attempts: faker.number.int({ min: 1, max: 5 }),
      },
      ...overrides,
    });
  }

  static createBruteForceAttempts(userId, count = 10) {
    return Array.from({ length: count }, (_, index) =>
      this.createFailedLogin(userId, {
        timestamp: faker.date.recent({ days: 1 }),
        metadata: {
          reason: 'invalid_credentials',
          attempts: index + 1,
          sourceIp: faker.internet.ip(),
        },
      })
    );
  }
}

module.exports = {
  UserFactory,
  SessionFactory,
  AuthEventFactory,
};
