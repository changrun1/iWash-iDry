<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
// 全局樣式在這裡導入
</script>

<style>
#app {
  font-family: 'Microsoft JhengHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: #f5f7fa;
}

.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.card-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.gradient-text {
  background: linear-gradient(45deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-available {
  background-color: #f0f9ff;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

.status-in-use {
  background-color: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

.status-maintenance {
  background-color: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

@media (max-width: 768px) {
  .content-wrapper {
    padding: 10px;
  }
}
</style>
