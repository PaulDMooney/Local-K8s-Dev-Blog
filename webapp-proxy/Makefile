BASEDIR = $(shell pwd)

build:
	-docker build --tag webapp-proxy:local .

install: overrides
	-helm install webapp-proxy ./helm/webapp-proxy -f ./helm/values/values-local.yaml -f .overrides.yaml -n test-app

uninstall:
	-helm uninstall webapp-proxy -n test-app

upgrade: overrides
	-helm upgrade webapp-proxy ./helm/webapp-proxy -f ./helm/values/values-local.yaml -f .overrides.yaml -n test-app

restart:
	-kubectl scale deployment webapp-proxy --replicas=0 -n test-app
	-kubectl scale deployment webapp-proxy --replicas=1 -n test-app

overrides:
	-touch .overrides.yaml