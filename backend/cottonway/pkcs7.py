#!/usr/bin/python2
from subprocess import Popen, PIPE
from tempfile import NamedTemporaryFile
from os import unlink
from re import sub
import sys
from base64 import b64decode
from base64 import b64encode

#OPENSSL = "/opt/local/bin/openssl"
OPENSSL = "openssl"
inCN="hidil"
inPUBKEY="-----BEGIN PUBLIC KEY-----\n\
MGMwHAYGKoUDAgITMBIGByqFAwICIwEGByqFAwICHgEDQwAEQOxUAvhsRrLuYCkn\n\
LHRvmkly5kGZvys0uw3XLi/dTM7bSwy+bg7PahujU6igxoiyZcvmr1HVJSZjlmzf\n\
27DG3Hk=\n\
-----END PUBLIC KEY-----\n"

def writeTempFile(data):
	f = NamedTemporaryFile(delete=False)
	f.write(data)
	f.close()
	return f

def runBashCommand(command):
	process = Popen(['bash', '-c', command], stdout=PIPE, stderr=PIPE)
	stdout, stderr = process.communicate()
#	print stdout, stderr, process.returncode
	return stdout, stderr, process.returncode

def process_pkcs7sign(pkcs7sign, inCN, inPUBKEY):
	f = None
	f1 = None
	try:
		starter="-----BEGIN PKCS7-----"
		ender = "-----END PKCS7-----"
		if not starter in pkcs7sign and not ender in pkcs7sign:
			pkcs7sign = "{}\n{}{}\n".format(starter, pkcs7sign, ender)

		f=writeTempFile(pkcs7sign)
		command = OPENSSL+ " pkcs7 -inform PEM -outform PEM -print_certs -engine gost <" + f.name
		stdout, _, _ = runBashCommand(command)
		

		certstarter = "-----BEGIN CERTIFICATE-----\n"
		certender = "-----END CERTIFICATE-----\n"
		cert = stdout[stdout.index(certstarter):stdout.index(certender)+len(certender)]

		f1=writeTempFile(cert)
		command = OPENSSL+ " x509 -noout -subject -in " + f1.name
		stdout, _, _ = runBashCommand(command)
		CN = sub("^.*CN=(.*)[\n/]?","\\1",stdout)
		if CN == inCN:
			command = OPENSSL+ " x509 -pubkey -engine gost -noout -in " + f1.name
			PUBKEY, _, _ = runBashCommand(command)
			if PUBKEY != inPUBKEY:
				return False

                import sys
                sys.stdout.write(CN)

		#command = OPENSSL+ " smime -verify -inform PEM -in " + f.name  + " -CAfile CA.pem -engine gost " #+ " -signer "+f1.name
		#_, _, verifyRV = runBashCommand(command) 

		#return verifyRV == 0
	finally:
                if f != None:
                        unlink(f.name)
                if f1 != None:
                        unlink(f1.name)

	return True

def main():
	try:
		if len(sys.argv) != 2:
			exit(1)
		p=b64decode(sys.argv[1])
		if process_pkcs7sign(p, inCN, inPUBKEY) != False:
			return
		exit(1)
	except:
		exit(1)

if __name__ == "__main__":
	main()
