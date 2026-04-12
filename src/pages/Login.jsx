import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, message, Divider, Space } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import '../styles/login.css';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.username, values.password);
      message.success('Login successful!');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (username, password) => {
    form.setFieldsValue({ username, password });
    handleLogin({ username, password });
  };

  return (
    <div className="login-container">
      <div className="login-background" />
      <Card className="login-card" bordered={false}>
        <div className="login-header">
          <div className="police-emblem">
            <SafetyCertificateOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          </div>
          <Title level={2} style={{ margin: '16px 0 8px' }}>Haryana Police</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
            Smart Case Management System
          </Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}

        <Form
          form={form}
          name="login"
          layout="vertical"
          onFinish={handleLogin}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Please input your username!' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" className="login-btn" loading={loading} block>
              Log In
            </Button>
          </Form.Item>
        </Form>

        <Divider plain>Dev: Quick Login Options</Divider>
        <Space direction="horizontal" style={{ width: '100%', justifyContent: 'center', flexWrap: 'wrap' }} size="small">
          <Button size="small" onClick={() => quickLogin('admin', 'admin123')}>Admin</Button>
          <Button size="small" onClick={() => quickLogin('io_1', 'io123')}>IO</Button>
          <Button size="small" onClick={() => quickLogin('sho_1', 'sho123')}>SHO</Button>
        </Space>

      </Card>
    </div>
  );
}
