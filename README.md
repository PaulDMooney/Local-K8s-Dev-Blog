# Ditching Docker-Compose for Kubernetes?

Usually I incorporate Docker Compose into my local development workflow: Bringing up supporting containers needed to run databases, reverse proxies, other applications, or just to see how the container I'm developing works. Given that Docker Desktop comes with a [single node] Kubernetes cluster and I usually end up deploying my containers to a Kubernetes cluster, I thought it would be good to figure out if I can switch from Docker-Compose to Kubernetes for local development. On top of that it's a good place to work the kinks out of my Kubernetes manifests or Helm charts without disrupting any shared environments.

To validate this I need to know how I'm going to handle the following:
* Building an image locally and running it on the K8s cluster.
* Running images on K8s that require persistent data (volume mounts).
* Running images on K8s that can communicate with process running on the host OS.
* Have a app on the host OS that can communicate with images running on K8s.

I'm going to setup the following applications to validate all of this:
1. An API Server that keeps count of the number of requests. The count will be saved into a file so this is where we can get a handle on the persistence. This will also let us try out communication from a process on the host OS to an app running on local K8s. Finally this is where we can experiment with making updates to an image and redeploying. Let's call it the Request Count Server.
1. A Webapp that makes a call to the Request Count Server and displays the results. This will be the app will be a host-os process, so we can try out making a call from an app on the host OS to an app on K8s (the Request Count Server). We're going to with a Single Page Application (SPA) that is also Server Side Rendered (SSR) so we have a reason to throw in a ...
1. Reverse Proxy. This will run on kubernetes and direct some http requests to the Webapp and some http requests to the Request Count Server. This should showcase an app running in k8s able to communicate with an app running on the host OS as well as typically inter-cluster communication we expect from k8s.

So we should see the flow of information like this:

TODO: Fix diagram
Browser --> Reverse Proxy (K8s) --> Webapp (Host OS)
                         \--> Reverse Proxy (K8s)

## The Request Count Server
This will be where a big chunk of the experiment is because it's where we're going to cover building an image and running it in k8s and, making changes, and persistence.

## The Webapp

## The Reverse Proxy