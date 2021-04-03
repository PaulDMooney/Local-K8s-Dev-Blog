BASEDIR = $(shell pwd)

build:
	-npm ci
	-docker build --tag request-count-server:local .

install:
	-kubectl apply -f volumes/pv-local.yaml
	-helm install request-count-server ./helm/request-count-server -f ./helm/values/values-local.yaml -n test-app

uninstall:
	-helm uninstall request-count-server -n test-app
	-kubectl delete -f volumes/pv-local.yaml

upgrade:
	-helm upgrade request-count-server ./helm/request-count-server -f ./helm/values/values-local.yaml -n test-app

restart:
	-kubectl scale deployment request-count-server --replicas=0 -n test-app
	-kubectl scale deployment request-count-server --replicas=1 -n test-app