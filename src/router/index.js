import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Session from '../views/Session.vue'
import JoinSession from '../views/JoinSession.vue'
import PrepareSession from '../views/PrepareSession.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/join/:id',
    name: 'JoinSession',
    component: JoinSession,
    props: true
  },
  {
    path: '/prepare/:sessionId',
    name: 'PrepareSession',
    component: PrepareSession,
    props: true
  },
  {
    path: '/session/:id',
    name: 'Session',
    component: Session,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
