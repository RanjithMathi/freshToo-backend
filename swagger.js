import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Chicken Delivery — Admin API',
      version: '1.0.0',
      description:
        'Admin backend for a chicken delivery application: staff accounts with roles, ' +
        'products/categories, customers, delivery zones & riders, orders, and dashboard reports.\n\n' +
        'Authenticate via `POST /auth/login`, then click **Authorize** and paste the token as `Bearer <token>`.',
    },
    servers: [{ url: '/', description: 'Current server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'Something went wrong' } },
        },
        Admin: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Super Admin' },
            email: { type: 'string', example: 'admin@chickendelivery.com' },
            role: { type: 'string', enum: ['super_admin', 'manager', 'staff'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Fresh Chicken' },
            description: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            category_id: { type: 'integer', nullable: true },
            name: { type: 'string', example: 'Chicken Breast Boneless' },
            description: { type: 'string', nullable: true },
            unit_type: { type: 'string', enum: ['piece', 'kg', 'combo'] },
            price: { type: 'number', format: 'float', example: 249.0 },
            stock_quantity: { type: 'number', example: 25 },
            low_stock_threshold: { type: 'number', example: 5 },
            image_url: { type: 'string', nullable: true },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Ravi Kumar' },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', example: '9876543210' },
            status: { type: 'string', enum: ['active', 'blocked'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Address: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            customer_id: { type: 'integer' },
            label: { type: 'string', example: 'Home' },
            address_line: { type: 'string' },
            city: { type: 'string' },
            pincode: { type: 'string' },
            is_default: { type: 'boolean' },
          },
        },
        DeliveryZone: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', example: 'Zone A - Central' },
            pincodes: { type: 'array', items: { type: 'string' }, example: ['620001', '620002'] },
            delivery_charge: { type: 'number', example: 30 },
            is_active: { type: 'boolean' },
          },
        },
        DeliveryPartner: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', example: 'Suresh' },
            phone: { type: 'string', example: '9876500000' },
            email: { type: 'string', nullable: true },
            vehicle_type: { type: 'string', nullable: true, example: 'bike' },
            zone_id: { type: 'integer', nullable: true },
            is_available: { type: 'boolean' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            order_id: { type: 'integer' },
            product_id: { type: 'integer' },
            product_name: { type: 'string' },
            quantity: { type: 'number' },
            unit_price: { type: 'number' },
            subtotal: { type: 'number' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            customer_id: { type: 'integer' },
            address_id: { type: 'integer', nullable: true },
            delivery_partner_id: { type: 'integer', nullable: true },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
            },
            payment_status: { type: 'string', enum: ['unpaid', 'paid', 'refunded', 'failed'] },
            payment_method: { type: 'string', enum: ['cod', 'card', 'upi', 'wallet'] },
            subtotal: { type: 'number' },
            delivery_charge: { type: 'number' },
            total_amount: { type: 'number' },
            notes: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        OrderCreateRequest: {
          type: 'object',
          required: ['customer_id', 'items'],
          properties: {
            customer_id: { type: 'integer', example: 1 },
            address_id: { type: 'integer', example: 1 },
            delivery_zone_id: { type: 'integer', example: 1 },
            payment_method: { type: 'string', enum: ['cod', 'card', 'upi', 'wallet'], example: 'cod' },
            notes: { type: 'string', example: 'Ring the bell twice' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['product_id', 'quantity'],
                properties: {
                  product_id: { type: 'integer', example: 3 },
                  quantity: { type: 'number', example: 2 },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./routes/*.js', './index.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
